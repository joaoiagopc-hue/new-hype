/* commands/admin/ticket_botoes.js
   Gerencia interações de tickets: criação de canal, atender, trocar atendente, fechar (modal),
   pedido de avaliação (1-5) e log de avaliações.
*/

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const dataStore = require('../../dataStore');

/*
 CONFIG - cole os IDs aqui (ou use .env)
 - STAFF_ROLE_ID: cargo que será marcado como staff
 - TICKET_CATEGORY_ID: categoria onde os canais de ticket serão criados
 - TICKET_LOG_CHANNEL_ID: canal onde logs de fechamento/avaliação irão (opcional)
 - TICKET_EVAL_CHANNEL_ID: canal onde será enviada a avaliação (opcional)
*/
const CONFIG = {
  STAFF_ROLE_ID: '1537883932497018932',
  TICKET_CATEGORY_ID: '1537936531761930370',
  TICKET_LOG_CHANNEL_ID: '1537937385852243968',
  TICKET_EVAL_CHANNEL_ID: '1537936623684165652'
};

const STAFF_ROLE_ID = CONFIG.STAFF_ROLE_ID && !CONFIG.STAFF_ROLE_ID.startsWith('COLOQUE') ? CONFIG.STAFF_ROLE_ID : process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = CONFIG.TICKET_CATEGORY_ID && !CONFIG.TICKET_CATEGORY_ID.startsWith('COLOQUE') ? CONFIG.TICKET_CATEGORY_ID : process.env.TICKET_CATEGORY_ID;
const TICKET_LOG_CHANNEL_ID = CONFIG.TICKET_LOG_CHANNEL_ID && !CONFIG.TICKET_LOG_CHANNEL_ID.startsWith('COLOQUE') ? CONFIG.TICKET_LOG_CHANNEL_ID : process.env.TICKET_LOG_CHANNEL_ID;
const TICKET_EVAL_CHANNEL_ID = CONFIG.TICKET_EVAL_CHANNEL_ID && !CONFIG.TICKET_EVAL_CHANNEL_ID.startsWith('COLOQUE') ? CONFIG.TICKET_EVAL_CHANNEL_ID : process.env.TICKET_EVAL_CHANNEL_ID;

// Sessões em memória não estritamente necessárias, persisto em dataStore também
// data.json.tickets -> { channelId: { memberId, type, attendantId, createdAt, closed, closeReason } }
function makeTicketChannelName(type, user) {
  const safe = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `${type}-${safe}-${user.id.slice(-4)}`;
}

function buildTicketEmbed(member, type) {
  return new EmbedBuilder()
    .setTitle(type === 'suporte' ? 'Ticket de Suporte' : 'Ticket de Denúncias')
    .setDescription(`Olá ${member}, aguarde a staff atender. Evite marcações em excesso e descreva seu problema com calma.`)
    .addFields(
      { name: 'Instruções', value: 'Aguarde a staff; não marque membros desnecessariamente. Use os botões abaixo para atendimento e fechamento.' },
      { name: 'Tipo', value: `${type}`, inline: true }
    )
    .setColor(0x2F3136)
    .setFooter({ text: 'Atendimento da staff' });
}

function buildTicketControls(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_attend|${channelId}`).setLabel('Atender').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket_change|${channelId}`).setLabel('Trocar atendente').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_close|${channelId}`).setLabel('Fechar ticket').setStyle(ButtonStyle.Danger)
  );
}

function buildEvalRow(ticketKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_rate|${ticketKey}|1`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_rate|${ticketKey}|2`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_rate|${ticketKey}|3`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_rate|${ticketKey}|4`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_rate|${ticketKey}|5`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success)
  );
}

// --- Interações (botões) ---
async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  const guild = interaction.guild;
  const user = interaction.user;

  // criação do ticket: customId = ticket_type|suporte OR ticket_type|denuncias
  if (customId.startsWith('ticket_type|')) {
    const parts = customId.split('|');
    const type = parts[1] === 'denuncias' ? 'denuncias' : 'suporte';

    // cria canal na categoria configurada
    try {
      const channelName = makeTicketChannelName(type, user);
      const categoryId = TICKET_CATEGORY_ID || null;

      const everyone = guild.roles.everyone;

      const perms = [
        { id: everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ];
      if (STAFF_ROLE_ID) {
        perms.push({ id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] });
      }

      const ch = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || undefined,
        permissionOverwrites: perms
      });

      // armazena ticket
      const data = dataStore.load();
      if (!data.tickets) data.tickets = {};
      data.tickets[ch.id] = {
        memberId: user.id,
        type,
        attendantId: null,
        createdAt: new Date().toISOString(),
        closed: false,
        closeReason: null
      };
      dataStore.save(data);

      // envia mensagem inicial no canal do ticket (marca staff)
      const mentionStaff = STAFF_ROLE_ID ? `<@&${STAFF_ROLE_ID}>` : 'staff';
      const embed = buildTicketEmbed(`<@${user.id}>`, type);
      const controls = buildTicketControls(ch.id);
      await ch.send({ content: `${mentionStaff}`, embeds: [embed], components: [controls] });

      // confirma para o usuário (ephemeral)
      return interaction.reply({ content: `✅ Ticket criado: ${ch}`, ephemeral: true });
    } catch (err) {
      console.error('Erro ao criar ticket:', err);
      return interaction.reply({ content: '❌ Erro ao criar ticket. Verifique permissões do bot.', ephemeral: true });
    }
  }

  // Atender: apenas staff deve poder atender
  if (customId.startsWith('ticket_attend|')) {
    const chId = customId.split('|')[1];
    const data = dataStore.load();
    const ticket = data.tickets?.[chId];
    if (!ticket) return interaction.reply({ content: 'Ticket não encontrado (possivelmente removido).', ephemeral: true });

    // permissões: apenas quem tem staff role pode atender
    const member = interaction.member;
    if (STAFF_ROLE_ID && !member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Apenas staff pode atender tickets.', ephemeral: true });
    }

    if (ticket.attendantId && ticket.attendantId === user.id) {
      return interaction.reply({ content: 'Você já está atendendo este ticket.', ephemeral: true });
    }

    // define atendente
    ticket.attendantId = user.id;
    data.tickets[chId] = ticket;
    dataStore.save(data);

    // notifica no canal
    const ch = await interaction.guild.channels.fetch(chId).catch(() => null);
    if (ch) {
      await ch.send({ content: `🟢 <@${user.id}> está atendendo este ticket.` });
    }

    return interaction.reply({ content: 'Você agora está atendendo este ticket.', ephemeral: true });
  }

  // Trocar atendente: qualquer staff que clicar se torna o atendente
  if (customId.startsWith('ticket_change|')) {
    const chId = customId.split('|')[1];
    const data = dataStore.load();
    const ticket = data.tickets?.[chId];
    if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

    const member = interaction.member;
    if (STAFF_ROLE_ID && !member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Apenas staff pode trocar atendente.', ephemeral: true });
    }

    ticket.attendantId = user.id;
    data.tickets[chId] = ticket;
    dataStore.save(data);

    const ch = await interaction.guild.channels.fetch(chId).catch(() => null);
    if (ch) await ch.send({ content: `🔁 Atendente trocado: agora <@${user.id}> está no atendimento.` });

    return interaction.reply({ content: 'Você agora é o atendente deste ticket.', ephemeral: true });
  }

  // Fechar ticket: só pode fechar se houver um atendente (e quem clicar deve ser staff)
  if (customId.startsWith('ticket_close|')) {
    const chId = customId.split('|')[1];
    const data = dataStore.load();
    const ticket = data.tickets?.[chId];
    if (!ticket) return interaction.reply({ content: 'Ticket não encontrado.', ephemeral: true });

    const member = interaction.member;
    if (STAFF_ROLE_ID && !member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: 'Apenas staff pode fechar tickets.', ephemeral: true });
    }

    if (!ticket.attendantId) {
      return interaction.reply({ content: 'O ticket só pode ser fechado quando houver um atendente.' , ephemeral: true});
    }

    // show modal para motivo
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal|${chId}`)
      .setTitle('Fechar Ticket - Motivo');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Motivo do fechamento')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('Descreva o motivo do fechamento...');

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
    return;
  }

  // Avaliação: botão de 1-5 vindo do DM do usuário (ou canal), customId ticket_rate|ticketKey|rating
  if (customId.startsWith('ticket_rate|')) {
    const parts = customId.split('|');
    const ticketKey = parts[1]; // normalmente channelId ou outra key
    const rating = parts[2];
    const data = dataStore.load();
    const ticket = data.tickets?.[ticketKey];

    // reply ephemerally (ou confirm in DM)
    await interaction.reply({ content: `Obrigado pela avaliação de ${rating} estrela(s)!`, ephemeral: true });

    // envia para canal de avaliação (se configurado)
    if (TICKET_EVAL_CHANNEL_ID) {
      const guild = interaction.guild || (await interaction.client.guilds.fetch(Object.keys(interaction.client.guilds.cache)[0]).catch(() => null));
      const evalCh = guild ? await guild.channels.fetch(TICKET_EVAL_CHANNEL_ID).catch(() => null) : null;
      const embed = new EmbedBuilder()
        .setTitle('Nova Avaliação de Ticket')
        .addFields(
          { name: 'Ticket', value: ticketKey || 'N/A', inline: true },
          { name: 'Avaliação', value: `${rating} estrela(s)`, inline: true },
          { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Atendente', value: ticket?.attendantId ? `<@${ticket.attendantId}>` : 'N/A', inline: true }
        )
        .setColor(0xFFD166)
        .setTimestamp();

      if (evalCh) await evalCh.send({ embeds: [embed] }).catch(() => null);
    }

    // marca no ticket (persist)
    if (ticket) {
      ticket.evaluation = { rating: Number(rating), by: interaction.user.id, at: new Date().toISOString() };
      data.tickets[ticketKey] = ticket;
      dataStore.save(data);
    }

    return;
  }

  // qualquer outro botão não tratado
  return;
}

// --- Modal submit handler (quando staff submete o motivo) ---
async function handleModalSubmit(interaction) {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;
  if (!customId.startsWith('ticket_close_modal|')) return;

  const chId = customId.split('|')[1];
  const reason = interaction.fields.getTextInputValue('close_reason');

  const data = dataStore.load();
  const ticket = data.tickets?.[chId];
  if (!ticket) {
    await interaction.reply({ content: 'Ticket não encontrado (ao tentar fechar).', ephemeral: true });
    return;
  }

  // marca como fechado e salva motivo
  ticket.closed = true;
  ticket.closeReason = reason;
  ticket.closedAt = new Date().toISOString();
  data.tickets[chId] = ticket;
  dataStore.save(data);

  // tranca canal: remove perm do membro (para que não envie mais)
  try {
    const channel = await interaction.guild.channels.fetch(chId);
    if (channel) {
      await channel.permissionOverwrites.create(ticket.memberId, { ViewChannel: false, SendMessages: false }).catch(() => null);
      // opcional: renomeia canal
      await channel.setName(`closed-${channel.name}`).catch(() => null);

      // notifica canal sobre fechamento com motivo e atendente
      const embed = new EmbedBuilder()
        .setTitle('Ticket fechado')
        .setDescription(`Fechado por <@${interaction.user.id}>`)
        .addFields(
          { name: 'Atendente', value: ticket.attendantId ? `<@${ticket.attendantId}>` : 'N/A', inline: true },
          { name: 'Motivo', value: reason || 'Sem motivo informado', inline: false }
        )
        .setColor(0xED4245)
        .setTimestamp();
      await channel.send({ embeds: [embed] });

      // Lógica: enviar DM para o membro solicitando avaliação (bot envia DM com botões 1-5)
      try {
        const dm = await interaction.client.users.fetch(ticket.memberId);
        const prompt = await dm.send({
          content: `Seu ticket (${ticket.type}) foi fechado. Por favor avalie o atendimento:`,
          components: [buildEvalRow(chId)]
        });
      } catch (e) {
        // não consegue DM, registra no log do servidor
        console.warn('Não foi possível enviar DM para o usuário com avaliação:', e?.message || e);
      }

      // envia log para canal de logs se configurado
      if (TICKET_LOG_CHANNEL_ID) {
        const logCh = await interaction.guild.channels.fetch(TICKET_LOG_CHANNEL_ID).catch(() => null);
        if (logCh) {
          const logEmbed = new EmbedBuilder()
            .setTitle('Log de Fechamento de Ticket')
            .addFields(
              { name: 'Ticket', value: chId, inline: true },
              { name: 'Tipo', value: ticket.type || 'N/A', inline: true },
              { name: 'Membro', value: `<@${ticket.memberId}>`, inline: true },
              { name: 'Atendente', value: ticket.attendantId ? `<@${ticket.attendantId}>` : 'N/A', inline: true },
              { name: 'Motivo', value: reason || 'Sem motivo informado', inline: false }
            )
            .setColor(0x5865F2)
            .setTimestamp();
          await logCh.send({ embeds: [logEmbed] }).catch(() => null);
        }
      }

      await interaction.reply({ content: 'Ticket fechado com sucesso e usuário solicitado a avaliar.', ephemeral: true });
      return;
    }
  } catch (err) {
    console.error('Erro ao finalizar ticket:', err);
    await interaction.reply({ content: 'Erro ao finalizar ticket (verifique permissões).', ephemeral: true });
    return;
  }
}

module.exports = { handleInteraction, handleModalSubmit };