// ticket_botoes.js
// Handler de botões/seletores para tickets (integração com painel HYPE).
// CONFIG no topo — cole os IDs do Discord aqui.

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const CONFIG = {
  TICKETS_CATEGORY_ID: '1537936531761930370',   // categoria onde os tickets serão criados
  STAFF_ROLE_ID: '1537883932497018932',               // cargo da equipe (pode fechar/atender)
  EVALUATIONS_CHANNEL_ID: '1537936623684165652' // canal onde avaliações serão enviadas
};

let client;
// in-memory tickets: channelId -> { openerId, attendantId }
const tickets = new Map();

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function handleInteraction(interaction) {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return false;

    // SelectMenu do painel HYPE: ticket_open_select
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_open_select') {
      const choice = interaction.values[0]; // atendimento / denuncia / duvida / compras / owner_league / outros
      // siga mesma lógica de criação de canal que havia para botões
      const typeLabel = {
        atendimento: 'Atendimento',
        denuncia: 'Denúncia',
        duvida: 'Dúvida',
        compras: 'Compras',
        owner_league: 'Owner League',
        outros: 'Outros'
      }[choice] || 'Atendimento';

      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: 'Somente no servidor.', ephemeral: true });

      const name = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
      const existing = guild.channels.cache.find(c => c.name === name);
      if (existing) return interaction.reply({ content: 'Você já tem um ticket aberto.', ephemeral: true });

      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];
      if (CONFIG.STAFF_ROLE_ID && CONFIG.STAFF_ROLE_ID !== 'COLE_AQUI_STAFF_ROLE_ID') {
        overwrites.push({ id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }

      const channel = await guild.channels.create({
        name,
        type: 0,
        parent: CONFIG.TICKETS_CATEGORY_ID && CONFIG.TICKETS_CATEGORY_ID !== 'COLE_AQUI_TICKETS_CATEGORY_ID' ? CONFIG.TICKETS_CATEGORY_ID : undefined,
        permissionOverwrites: overwrites
      });

      const atenderBtn = new ButtonBuilder().setCustomId(`ticket_atender_${channel.id}`).setLabel('Atender').setStyle(ButtonStyle.Success);
      const trocarBtn = new ButtonBuilder().setCustomId(`ticket_trocar_${channel.id}`).setLabel('Trocar atendente').setStyle(ButtonStyle.Primary);
      const fecharBtn = new ButtonBuilder().setCustomId(`ticket_fechar_${channel.id}`).setLabel('Fechar ticket').setStyle(ButtonStyle.Danger);

      const embed = new EmbedBuilder()
        .setTitle(`Ticket - ${typeLabel}`)
        .setDescription(`Olá <@${interaction.user.id}> — descreva seu problema aqui. A equipe HYPE vai te atender.`)
        .setColor('#111013');

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [ new ActionRowBuilder().addComponents(atenderBtn, trocarBtn, fecharBtn) ] });

      tickets.set(channel.id, { openerId: interaction.user.id, attendantId: null });
      await interaction.reply({ content: `Ticket criado: ${channel}`, ephemeral: true });
      return true;
    }

    // Atender / Trocar / Fechar (botões dentro do canal do ticket)
    if (interaction.isButton() && (interaction.customId.startsWith('ticket_atender_') || interaction.customId.startsWith('ticket_trocar_') || interaction.customId.startsWith('ticket_fechar_'))) {
      const parts = interaction.customId.split('_');
      const action = parts[1];
      const channelId = parts.slice(2).join('_');
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      // somente staff pode executar
      if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ content: 'Somente staff pode executar esta ação.', ephemeral: true });
      }

      if (action === 'atender') {
        if (ticket.attendantId) return interaction.reply({ content: 'Este ticket já possui atendente.', ephemeral: true });
        ticket.attendantId = interaction.user.id;
        tickets.set(channelId, ticket);
        const ch = await client.channels.fetch(channelId);
        await ch.send(`Atendimento iniciado por <@${interaction.user.id}>`);
        return interaction.reply({ content: 'Você iniciou o atendimento.', ephemeral: true });
      }

      if (action === 'trocar') {
        // apresentar select menu com membros que possuem o cargo STAFF_ROLE_ID
        try {
          const guild = interaction.guild;
          const role = guild.roles.cache.get(CONFIG.STAFF_ROLE_ID) || await guild.roles.fetch(CONFIG.STAFF_ROLE_ID).catch(() => null);
          if (!role) return interaction.reply({ content: 'Cargo de staff não encontrado/configurado.', ephemeral: true });

          const members = role.members.map(m => m).filter(m => !m.user.bot);
          if (members.length === 0) return interaction.reply({ content: 'Nenhum membro com o cargo de staff foi encontrado.', ephemeral: true });

          const options = members.slice(0,25).map(m => ({
            label: m.user.username.length > 100 ? m.user.username.slice(0,97)+'...' : m.user.username,
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
          console.error('Erro ao criar select de staff', err);
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

    // Select menu para atribuir atendente (ticket_select_assign|<channelId>)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select_assign|')) {
      const channelId = interaction.customId.split('|')[1];
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      if (!interaction.member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ content: 'Somente staff pode executar esta ação.', ephemeral: true });
      }

      const selected = interaction.values[0];
      ticket.attendantId = selected;
      tickets.set(channelId, ticket);

      try {
        const ch = await client.channels.fetch(channelId);
        await ch.send(`Atendimento atribuído a <@${selected}> por ${interaction.user.tag}`);
      } catch (err) { console.error('Erro ao notificar canal do ticket após troca', err); }

      return interaction.reply({ content: `Atendente alterado para <@${selected}>.`, ephemeral: true });
    }

    // Modal submit para fechamento
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_close_modal|')) {
      const channelId = interaction.customId.split('|')[1];
      const ticket = tickets.get(channelId);
      if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

      const reason = interaction.fields.getTextInputValue('close_reason');
      await interaction.reply({ content: 'Fechando ticket em 20 segundos...', ephemeral: true });

      try {
        const ch = await client.channels.fetch(channelId);
        await ch.send(`Ticket será fechado por ${interaction.user.tag}. Motivo: ${reason}\nFechando em 20s...`);
      } catch (err) { console.error('Erro notificar canal antes de fechar', err); }

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
          } catch (err) { console.error('Erro ao DM opener para rating', err); }

          try {
            const ch = await client.channels.fetch(channelId);
            await ch.delete('Ticket fechado e removido pelo bot');
          } catch (err) { console.error('Erro ao deletar canal', err); }

          tickets.delete(channelId);
        } catch (err) {
          console.error('Erro no timeout de fechar ticket', err);
        }
      }, 20000);

      return true;
    }

    // Rating buttons: rate_<channelId>_<1..5>
    if (interaction.isButton() && interaction.customId.startsWith('rate_')) {
      const [, channelId, stars] = interaction.customId.split('_');
      const rating = Number(stars);
      await interaction.reply({ content: `Obrigado pela avaliação: ${rating} estrela(s).`, ephemeral: true });

      try {
        const t = tickets.get(channelId);
        const openerId = t ? t.openerId : null;
        const attendantId = t ? t.attendantId : null;

        if (CONFIG.EVALUATIONS_CHANNEL_ID && CONFIG.EVALUATIONS_CHANNEL_ID !== 'COLE_AQUI_EVALUATIONS_CHANNEL_ID') {
          const ch = await client.channels.fetch(CONFIG.EVALUATIONS_CHANNEL_ID);
          if (ch) {
            const embed = new EmbedBuilder()
              .setTitle('Avaliação de Atendimento')
              .addFields(
                { name: 'Ticket', value: channelId, inline: true },
                { name: 'Avaliação', value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true },
                { name: 'Usuário (opener)', value: openerId ? `<@${openerId}>` : 'Desconhecido', inline: false },
                { name: 'Atendente', value: attendantId ? `<@${attendantId}>` : 'Sem atendente', inline: false }
              )
              .setColor('#050504')
              .setTimestamp();
            await ch.send({ embeds: [embed] });
          }
        }
      } catch (err) { console.error('Erro ao enviar avaliação para canal', err); }

      return true;
    }

    return false;
  } catch (err) {
    console.error('ticket_botoes error', err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno no sistema de tickets.', ephemeral: true }); } catch {}
    return false;
  }
}

module.exports = { setup, handleInteraction, CONFIG };