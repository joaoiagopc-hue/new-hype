// index.js
require('dotenv').config(); // se usar .env localmente
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

// CONFIG via env
const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID; // onde staff recebe aplicações (ou define no comando)
const WL_ROLE_ID = process.env.WL_ROLE_ID; // cargo a ser dado quando aprovar
const PANEL_TITLE = 'Painel de Whitelist';
const DATA_FILE = path.join(__dirname, 'data.json');
const PREFIX = '!';

// util: carrega/guarda data.json
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { nextId: 1000, applications: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// util: trunca nickname pra <= 32 chars (Discord limit)
function makeNickname(id, name) {
  const base = `${id} | ${name}`;
  if (base.length <= 32) return base;
  // corta o nome mantendo o id e " | "
  const maxNameLen = 32 - (String(id).length + 3); // " | " = 3
  const shortName = name.slice(0, Math.max(0, maxNameLen));
  return `${id} | ${shortName}`;
}

// Deleta painéis antigos do bot naquele canal (procura embed de título PANEL_TITLE)
async function deleteOldPanels(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 100 });
    const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === PANEL_TITLE);
    for (const m of botMsgs.values()) {
      await m.delete().catch(() => {});
    }
  } catch (err) {
    console.error('Erro ao deletar old panels', err);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;
  const [cmd, ...rest] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (cmd.toLowerCase() === 'painel-wl') {
    // check permission
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa de permissão de Gerenciar Servidor para usar esse comando.', ephemeral: true });
    }

    // delete old panels in this channel
    await deleteOldPanels(message.channel);

    // create embed and button
    const embed = new EmbedBuilder()
      .setTitle(PANEL_TITLE)
      .setDescription('Clique em **Pedir WL** para preencher o formulário de whitelist. Leia as regras antes de aplicar.')
      .setColor('#0099ff')
      .addFields({ name: 'Requisitos', value: '- Ser ativo no servidor\n- Ler regras do canal' });

    const btn = new ButtonBuilder()
      .setCustomId('wl_apply')
      .setLabel('Pedir WL')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de WL enviado.', ephemeral: true });
  }
});

// Interaction handler: button show modal / modal submit / approve/reject
client.on('interactionCreate', async (interaction) => {
  // Button: open modal
  if (interaction.isButton() && interaction.customId === 'wl_apply') {
    const modal = new ModalBuilder()
      .setCustomId('wl_modal')
      .setTitle('Formulário de Whitelist');

    const nickInput = new TextInputBuilder()
      .setCustomId('wl_name')
      .setLabel('Seu nick no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const whyInput = new TextInputBuilder()
      .setCustomId('wl_why')
      .setLabel('Por que devemos te whitelistar?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(nickInput);
    const row2 = new ActionRowBuilder().addComponents(whyInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
    return;
  }

  // Modal submit: send application to staff channel
  if (interaction.isModalSubmit() && interaction.customId === 'wl_modal') {
    const nick = interaction.fields.getTextInputValue('wl_name');
    const motivo = interaction.fields.getTextInputValue('wl_why');
    const applicant = interaction.user;

    // create application id (timestamp)
    const appId = Date.now().toString();

    // prepare embed for staff
    const appEmbed = new EmbedBuilder()
      .setTitle('Nova inscrição de WL')
      .addFields(
        { name: 'App ID', value: appId, inline: true },
        { name: 'Nick (declared)', value: nick, inline: true },
        { name: 'Usuário', value: `${applicant.tag} (${applicant.id})`, inline: false },
        { name: 'Motivo', value: motivo }
      )
      .setFooter({ text: `Aplicante ID: ${applicant.id}` })
      .setTimestamp();

    const approveBtn = new ButtonBuilder().setCustomId(`wl_approve_${appId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success);
    const rejectBtn = new ButtonBuilder().setCustomId(`wl_reject_${appId}`).setLabel('Reprovar').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

    // target channel for staff
    const staffChannelId = STAFF_CHANNEL_ID || null;
    let targetChannel = null;
    if (staffChannelId) {
      try {
        targetChannel = await interaction.guild.channels.fetch(staffChannelId);
      } catch (err) {
        console.error('Não consegui buscar staff channel', err);
      }
    }
    if (!targetChannel) targetChannel = interaction.channel; // fallback to same channel

    const sent = await targetChannel.send({ embeds: [appEmbed], components: [row] });

    // store application mapping in data.json
    const data = loadData();
    data.applications[appId] = {
      applicantId: applicant.id,
      messageId: sent.id,
      channelId: sent.channel.id,
      declaredNick: nick,
      motivo,
      status: 'pending'
    };
    saveData(data);

    await interaction.reply({ content: 'Sua inscrição foi enviada! Aguarde a avaliação da staff.', ephemeral: true });
    return;
  }

  // Approve / Reject button handlers (only staff)
  if (interaction.isButton() && (interaction.customId.startsWith('wl_approve_') || interaction.customId.startsWith('wl_reject_'))) {
    // check permission: only members with ManageGuild (or you can check a specific role)
    if (!interaction.member.permissions.has('ManageGuild')) {
      return interaction.reply({ content: 'Você não tem permissão para isso.', ephemeral: true });
    }

    const isApprove = interaction.customId.startsWith('wl_approve_');
    const appId = interaction.customId.split('_').slice(2).join('_'); // wl_approve_<id>
    const data = loadData();
    const app = data.applications[appId];
    if (!app) {
      return interaction.reply({ content: 'Aplicação não encontrada (pode ter expirado).', ephemeral: true });
    }
    if (app.status !== 'pending') {
      return interaction.reply({ content: `Aplicação já foi processada: ${app.status}.`, ephemeral: true });
    }

    // fetch the applicant member
    let member;
    try {
      member = await interaction.guild.members.fetch(app.applicantId);
    } catch (err) {
      console.error('Erro fetch member', err);
    }

    if (isApprove) {
      // assign ID and role, update nickname
      const next = data.nextId || 1000;
      const assignedId = next;
      data.nextId = next + 1;

      // give WL role if configured
      if (WL_ROLE_ID && member) {
        try {
          await member.roles.add(WL_ROLE_ID, `Approved WL by ${interaction.user.tag}`);
        } catch (err) {
          console.error('Erro ao adicionar role', err);
        }
      }

      // change nickname
      if (member) {
        try {
          const baseName = member.nickname || member.user.username;
          const newNick = makeNickname(assignedId, baseName);
          await member.setNickname(newNick, `WL approved by ${interaction.user.tag}`);
        } catch (err) {
          console.error('Erro ao setNickname', err);
          // optionally notify staff that nickname change falhou
        }
      }

      // update app record
      app.status = 'approved';
      app.assignedId = assignedId;
      app.approvedBy = interaction.user.id;
      app.approvedAt = new Date().toISOString();
      saveData(data);

      // update staff message embed
      const msgChannel = await interaction.client.channels.fetch(app.channelId);
      const appMsg = await msgChannel.messages.fetch(app.messageId);
      const updatedEmbed = EmbedBuilder.from(appMsg.embeds[0])
        .setColor('#2ecc71')
        .addFields({ name: 'Status', value: `Aprovado por ${interaction.user.tag} — ID: ${assignedId}` });
      await appMsg.edit({ embeds: [updatedEmbed], components: [] });

      await interaction.reply({ content: `Aplicação aprovada. ID atribuído: ${assignedId}`, ephemeral: true });

      // DM the user (optional)
      if (member) {
        member.send(`Sua aplicação foi aprovada! Seu ID é ${assignedId}. Seu nick foi atualizado para "${makeNickname(assignedId, member.user.username)}".`).catch(() => {});
      }

    } else {
      // reject
      app.status = 'rejected';
      app.rejectedBy = interaction.user.id;
      app.rejectedAt = new Date().toISOString();
      saveData(data);

      // update staff message embed
      const msgChannel = await interaction.client.channels.fetch(app.channelId);
      const appMsg = await msgChannel.messages.fetch(app.messageId);
      const updatedEmbed = EmbedBuilder.from(appMsg.embeds[0])
        .setColor('#e74c3c')
        .addFields({ name: 'Status', value: `Reprovado por ${interaction.user.tag}` });
      await appMsg.edit({ embeds: [updatedEmbed], components: [] });

      await interaction.reply({ content: 'Aplicação reprovada.', ephemeral: true });

      // DM the user (optional)
      try {
        const user = await client.users.fetch(app.applicantId);
        user.send('Sua aplicação foi reprovada.').catch(() => {});
      } catch (err) {}
    }
  }
});

client.login(process.env.DISCORD_TOKEN);