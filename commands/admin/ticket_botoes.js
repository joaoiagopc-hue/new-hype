// commands/admin/ticket_botoes.js
// Handler de botões/seletores para sistema de tickets (agora aceita botões do painel).
// CONFIG no topo — cole os IDs do Discord aqui.
//
// CONFIG fields:
//  - TICKETS_CATEGORY_ID: (opcional) ID da categoria onde tickets serão criados
//  - STAFF_ROLE_ID: ID do cargo da staff (obrigatório para ações de staff)
//  - STAFF_CHANNEL_ID: (opcional) canal onde notificações de erro/alerts serão enviadas
//  - EVALUATIONS_CHANNEL_ID: (opcional) canal para onde avaliações de tickets serão postadas

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ChannelType
} = require('discord.js');

const CONFIG = {
  TICKETS_CATEGORY_ID: '1537936531761930370',
  STAFF_ROLE_ID: '1537883932497018932',
  STAFF_CHANNEL_ID: '1537937385852243968',
  EVALUATIONS_CHANNEL_ID: '1537936623684165652'
};

let client;
// in-memory tickets map: channelId -> { openerId, attendantId }
const tickets = new Map();

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
  console.log('ticket_botoes setup — CONFIG:', {
    TICKETS_CATEGORY_ID: CONFIG.TICKETS_CATEGORY_ID,
    STAFF_ROLE_ID: CONFIG.STAFF_ROLE_ID,
    STAFF_CHANNEL_ID: CONFIG.STAFF_CHANNEL_ID,
    EVALUATIONS_CHANNEL_ID: CONFIG.EVALUATIONS_CHANNEL_ID
  });
}

async function handleInteraction(interaction) {
  try {
    // lidando apenas com botões, selects e modals relevantes
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return false;

    // --- NOVO: Painel com botões -> abrir ticket
    if (interaction.isButton() && interaction.customId && interaction.customId.startsWith('ticket_open_')) {
      try {
        const typeKey = interaction.customId.replace('ticket_open_', ''); // 'denuncia' | 'suporte' | 'compras'
        const typeLabel = { denuncia: 'Denúncia', suporte: 'Suporte', compras: 'Compras' }[typeKey] || 'Atendimento';
        const guild = interaction.guild;
        if (!guild) {
          await interaction.reply({ content: 'Este painel só funciona no servidor.', ephemeral: true });
          return true;
        }

        // checar permissão do bot para criar canais
        try {
          const botMember = guild.members.me;
          if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: 'Erro: o bot precisa da permissão "Gerenciar Canais" para abrir tickets. Peça ao admin para dar essa permissão.', ephemeral: true });
            return true;
          }
        } catch (e) {
          console.warn('Aviso: não foi possível checar guild.members.me — continuando. Erro:', e?.message || e);
        }

        const name = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
        const existing = guild.channels.cache.find(c => c.name === name);
        if (existing) {
          await interaction.reply({ content: 'Você já tem um ticket aberto.', ephemeral: true });
          return true;
        }

        const overwrites = [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ];
        if (CONFIG.STAFF_ROLE_ID && CONFIG.STAFF_ROLE_ID !== 'COLE_AQUI_STAFF_ROLE_ID') {
          overwrites.push({ id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        }

        // resolve parent/category se configurado
        let parentOption;
        if (CONFIG.TICKETS_CATEGORY_ID && CONFIG.TICKETS_CATEGORY_ID !== 'COLE_AQUI_TICKETS_CATEGORY_ID') {
          try {
            const parentCh = await guild.channels.fetch(CONFIG.TICKETS_CATEGORY_ID).catch(() => null);
            if (parentCh && parentCh.type === ChannelType.GuildCategory) parentOption = parentCh.id;
            else {
              console.warn('TICKETS_CATEGORY_ID configurada inválida ou não é categoria:', CONFIG.TICKETS_CATEGORY_ID);
            }
          } catch (e) {
            console.warn('Erro ao buscar categoria de tickets:', e && e.stack ? e.stack : e);
          }
        }

        // criar canal
        let channel;
        try {
          channel = await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: parentOption,
            permissionOverwrites: overwrites
          });
        } catch (err) {
          console.error('Erro criando canal de ticket:', err && err.stack ? err.stack : err);
          await notifyStaff(`Erro criando canal de ticket: ${err && err.message ? err.message : String(err)}`, err);
          await safeReply(interaction, 'Erro ao criar o canal do ticket. Verifique permissões do bot e se a categoria existe.');
          return true;
        }

        // message inicial no ticket
        const atenderBtn = new ButtonBuilder().setCustomId(`ticket_atender_${channel.id}`).setLabel('Atender').setStyle(ButtonStyle.Success);
        const trocarBtn = new ButtonBuilder().setCustomId(`ticket_trocar_${channel.id}`).setLabel('Trocar atendente').setStyle(ButtonStyle.Primary);
        const fecharBtn = new ButtonBuilder().setCustomId(`ticket_fechar_${channel.id}`).setLabel('Fechar ticket').setStyle(ButtonStyle.Danger);

        const embed = new EmbedBuilder()
          .setTitle(`Ticket - ${typeLabel}`)
          .setDescription(`Olá <@${interaction.user.id}> — descreva seu problema aqui.\n\nA equipe HYPE atenderá seu ticket em breve.`)
          .setColor('#030303');

        try {
          await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [ new ActionRowBuilder().addComponents(atenderBtn, trocarBtn, fecharBtn) ] });
        } catch (err) {
          console.error('Erro enviando mensagem inicial no ticket:', err && err.stack ? err.stack : err);
        }

        tickets.set(channel.id, { openerId: interaction.user.id, attendantId: null });
        await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
        return true;

      } catch (err) {
        console.error('Erro ao processar botão de abertura de ticket:', err && err.stack ? err.stack : err);
        await notifyStaff('Erro ao processar ticket_open_*', err);
        await safeReply(interaction, 'Erro interno ao abrir o ticket. Contate a staff.');
        return true;
      }
    }

    // --- resto das branches: atender/trocar/fechar/select de atribuição/modal/ratings
    // Reaproveitei a lógica das versões anteriores (atender/trocar/fechar/assign/close/rating)
    // Atender / Trocar / Fechar
    if (interaction.isButton() && (interaction.customId.startsWith('ticket_atender_') || interaction.customId.startsWith('ticket_trocar_') || interaction.customId.startsWith('ticket_fechar_'))) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const channelId = parts.slice(2).join('_');
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado (ou já fechado).', ephemeral: true });

      if (!interaction.member || (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))) {
        return interaction.reply({ content: 'Somente staff pode executar esta ação.', ephemeral: true });
      }

      if (action === 'atender') {
        if (ticket.attendantId) return interaction.reply({ content: 'Este ticket já possui atendente.', ephemeral: true });
        ticket.attendantId = interaction.user.id;
        tickets.set(channelId, ticket);
        const ch = await client.channels.fetch(channelId).catch(()=>null);
        if (ch) await ch.send(`Atendimento iniciado por <@${interaction.user.id}>`);
        return interaction.reply({ content: 'Você iniciou o atendimento.', ephemeral: true });
      }

      if (action === 'trocar') {
        try {
          const guild = interaction.guild;
          const role = guild.roles.cache.get(CONFIG.STAFF_ROLE_ID) || await guild.roles.fetch(CONFIG.STAFF_ROLE_ID).catch(() => null);
          if (!role) return interaction.reply({ content: 'Cargo de staff não encontrado/configurado.', ephemeral: true });

          const members = role.members.map(m => m).filter(m => !m.user.bot);
          if (members.length === 0) return interaction.reply({ content: 'Nenhum membro com o cargo de staff foi encontrado.', ephemeral: true });

          const options = members.slice(0, 25).map(m => ({
            label: m.user.username.length > 100 ? m.user.username.slice(0, 97) + '...' : m.user.username,
            value: m.id,
            description: m.user.tag
          }));

          const select = new StringSelectMenuBuilder()
            .setCustomId(`ticket_select_assign|${channelId}`)
            .setPlaceholder('Selecione o staff para atribuir como atendente')
            .addOptions(options)
            .setMinValues(1)
            .setMaxValues(1);

          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: 'Selecione o staff que será o novo atendente:', components: [row], ephemeral: true });
        } catch (err) {
          console.error('Erro ao criar select de staff:', err && err.stack ? err.stack : err);
          await notifyStaff('Erro ao criar select de staff', err);
          return interaction.reply({ content: 'Erro ao listar staff.', ephemeral: true });
        }
      }

      if (action === 'fechar') {
        if (!ticket.attendantId) return interaction.reply({ content: 'Só é possível fechar com um atendente atribuído.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`ticket_close_modal|${channelId}`).setTitle('Fechar Ticket - Motivo');
        const motivo = new TextInputBuilder().setCustomId('close_reason').setLabel('Motivo do fechamento').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(motivo));
        await interaction.showModal(modal);
        return true;
      }
    }

    // Select assign
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select_assign|')) {
      const channelId = interaction.customId.split('|')[1];
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      if (!interaction.member || (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))) {
        return interaction.reply({ content: 'Somente staff pode executar esta ação.', ephemeral: true });
      }

      const selected = interaction.values[0];
      ticket.attendantId = selected;
      tickets.set(channelId, ticket);

      try {
        const ch = await client.channels.fetch(channelId).catch(()=>null);
        if (ch) await ch.send(`Atendimento atribuído a <@${selected}> por ${interaction.user.tag}`);
      } catch (err) {
        console.error('Erro ao notificar canal após troca:', err && err.stack ? err.stack : err);
      }

      return interaction.reply({ content: `Atendente alterado para <@${selected}>.`, ephemeral: true });
    }

    // Modal submit for closing ticket
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_modal|')) {
      const channelId = interaction.customId.split('|')[1];
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      const reason = interaction.fields.getTextInputValue('close_reason');
      await interaction.reply({ content: 'Fechando ticket em 20 segundos...', ephemeral: true });

      try {
        const ch = await client.channels.fetch(channelId).catch(()=>null);
        if (ch) await ch.send(`Ticket será fechado por ${interaction.user.tag}. Motivo: ${reason}\nFechando em 20s...`);
      } catch (err) {
        console.error('Erro notificar canal antes de fechar:', err && err.stack ? err.stack : err);
      }

      setTimeout(async () => {
        try {
          const t = tickets.get(channelId);
          if (!t) return;

          try {
            const opener = await client.users.fetch(t.openerId);
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`rate_${channelId}_1`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`rate_${channelId}_2`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`rate_${channelId}_3`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`rate_${channelId}_4`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`rate_${channelId}_5`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
            );
            await opener.send({ content: 'Seu ticket foi fechado. Avalie o atendimento:', components: [row] }).catch(()=>{});
          } catch (err) {
            console.error('Erro ao DM opener para rating:', err && err.stack ? err.stack : err);
          }

          try {
            const ch = await client.channels.fetch(channelId).catch(()=>null);
            if (ch) await ch.delete('Ticket fechado e removido pelo bot');
          } catch (err) {
            console.error('Erro ao deletar canal do ticket:', err && err.stack ? err.stack : err);
          }

          tickets.delete(channelId);
        } catch (err) {
          console.error('Erro no timeout de fechar ticket:', err && err.stack ? err.stack : err);
        }
      }, 20000);

      return true;
    }

    // Rating buttons
    if (interaction.isButton() && interaction.customId.startsWith('rate_')) {
      const [, channelId, stars] = interaction.customId.split('_');
      const rating = Number(stars);
      await interaction.reply({ content: `Obrigado pela avaliação: ${rating} estrela(s).`, ephemeral: true });

      try {
        const t = tickets.get(channelId);
        const openerId = t ? t.openerId : null;
        const attendantId = t ? t.attendantId : null;

        if (CONFIG.EVALUATIONS_CHANNEL_ID && CONFIG.EVALUATIONS_CHANNEL_ID !== 'COLE_AQUI_EVALUATIONS_CHANNEL_ID') {
          const ch = await client.channels.fetch(CONFIG.EVALUATIONS_CHANNEL_ID).catch(()=>null);
          if (ch) {
            const embed = new EmbedBuilder()
              .setTitle('Avaliação de Atendimento')
              .addFields(
                { name: 'Ticket', value: channelId, inline: true },
                { name: 'Avaliação', value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true },
                { name: 'Usuário (opener)', value: openerId ? `<@${openerId}>` : 'Desconhecido', inline: false },
                { name: 'Atendente', value: attendantId ? `<@${attendantId}>` : 'Sem atendente', inline: false }
              )
              .setColor('#000000')
              .setTimestamp();
            await ch.send({ embeds: [embed] }).catch((e) => console.error('Erro enviando avaliação para canal:', e && e.stack ? e.stack : e));
          }
        }
      } catch (err) {
        console.error('Erro ao processar avaliação:', err && err.stack ? err.stack : err);
      }

      return true;
    }

    return false;
  } catch (err) {
    console.error('ticket_botoes general error:', err && err.stack ? err.stack : err);
    try {
      if (CONFIG.STAFF_CHANNEL_ID && CONFIG.STAFF_CHANNEL_ID !== 'COLE_AQUI_STAFF_CHANNEL_ID') {
        const ch = await client.channels.fetch(CONFIG.STAFF_CHANNEL_ID).catch(()=>null);
        if (ch) await ch.send(`⚠️ Erro no sistema de tickets: ${err && err.message ? err.message : 'ver logs'}`).catch(()=>{});
      }
    } catch (e) { console.warn('Erro notificando staff:', e && e.stack ? e.stack : e); }

    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno no sistema de tickets. Consulte os logs.', ephemeral: true }); } catch {}
    return true;
  }
}

// helper safe reply
async function safeReply(interaction, message) {
  try {
    if (!interaction) return;
    if (interaction.deferred || interaction.replied) {
      try { await interaction.followUp({ content: message, ephemeral: true }); } catch { /* ignore */ }
    } else {
      try { await interaction.reply({ content: message, ephemeral: true }); } catch { /* ignore */ }
    }
  } catch (e) { console.error('safeReply error', e && e.stack ? e.stack : e); }
}

// helper notify staff with stack
async function notifyStaff(shortMsg, err) {
  try {
    if (!CONFIG.STAFF_CHANNEL_ID || CONFIG.STAFF_CHANNEL_ID === 'COLE_AQUI_STAFF_CHANNEL_ID') return;
    const ch = await client.channels.fetch(CONFIG.STAFF_CHANNEL_ID).catch(()=>null);
    if (!ch) return;
    const title = `⚠️ [Ticket System] ${shortMsg}`;
    const stack = err && err.stack ? `\`\`\`\n${(err.stack + '').slice(0, 1900)}\n\`\`\`` : 'Sem stacktrace';
    await ch.send({ content: `${title}\n${stack}` }).catch(()=>{});
  } catch (e) {
    console.error('notifyStaff error', e && e.stack ? e.stack : e);
  }
}

module.exports = { setup, handleInteraction, CONFIG };