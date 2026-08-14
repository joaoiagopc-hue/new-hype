// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

// Configs via env
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const STAFF_CHANNEL_ID = process.env.STAFF_CHANNEL_ID || null;
const WL_ROLE_ID = process.env.WL_ROLE_ID || null;
const DATA_FILE = path.join(__dirname, 'data.json');
const PREFIX = '!';
const PANEL_TITLE = 'Painel de Whitelist';

// cria data.json se não existir
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { nextId: 1000, applications: {}, ids: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw || '{}');
  if (!data.nextId) data.nextId = 1000;
  if (!data.applications) data.applications = {};
  if (!data.ids) data.ids = {};
  return data;
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// nickname formatter (trunca se passar de 32 chars)
function makeNickname(id, name) {
  const base = `${id} | ${name}`;
  if (base.length <= 32) return base;
  const idLen = String(id).length;
  const maxNameLen = 32 - (idLen + 3);
  const shortName = name.slice(0, Math.max(0, maxNameLen));
  return `${id} | ${shortName}`;
}

// Inicializa o client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Deleta painéis antigos do bot naquele canal (procura embed com título PANEL_TITLE)
// agora recebe client como parâmetro para evitar usar variável antes da declaração
async function deleteOldPanels(clientInstance, channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 100 });
    const botMsgs = msgs.filter(m => m.author?.id === clientInstance.user.id && m.embeds?.[0]?.title === PANEL_TITLE);
    for (const m of botMsgs.values()) {
      await m.delete().catch(() => {});
    }
  } catch (err) {
    console.error('Erro ao deletar painéis antigos:', err);
  }
}

// Mensagens por prefixo (!painel-wl e !id)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // !painel-wl : apaga painéis antigos e publica o embed com botão
  if (cmd === 'painel-wl') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa de permissão Gerenciar Servidor para usar esse comando.', ephemeral: true });
    }

    await deleteOldPanels(client, message.channel);

    const embed = new EmbedBuilder()
      .setTitle(PANEL_TITLE)
      .setDescription('Clique em **Pedir WL** para preencher o formulário de whitelist. Leia as regras antes.')
      .setColor('#0099ff')
      .addFields({ name: 'Requisitos', value: '- Ser ativo no servidor\n- Ler as regras' });

    const btn = new ButtonBuilder()
      .setCustomId('wl_apply')
      .setLabel('Pedir WL')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btn);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de WL enviado.', ephemeral: true });
    return;
  }

  // !id : atribui ou mostra ID e tenta atualizar nickname
  if (cmd === 'id') {
    const guild = message.guild;
    if (!guild) return message.reply({ content: 'Este comando só funciona dentro de um servidor.' });

    const member = message.member;
    if (!member) return message.reply({ content: 'Não consegui obter seu membro no servidor.' });

    const data = loadData();
    let assigned = data.ids[member.id];
    if (!assigned) {
      assigned = data.nextId || 1000;
      data.nextId = Number(data.nextId || 1000) + 1;
      data.ids[member.id] = assigned;
      saveData(data);
    }

    const currentName = (member.nickname || member.user.username);
    const newNick = makeNickname(assigned, currentName);

    let nickChanged = false;
    try {
      if (member.manageable && member.nickname !== newNick) {
        await member.setNickname(newNick, 'ID assigned/confirmed via !id');
        nickChanged = true;
      }
    } catch (err) {
      console.error('Falha ao alterar nickname:', err);
    }

    if (nickChanged) {
      return message.reply(`✅ Seu ID é **${assigned}** — nickname atualizado para: \`${newNick}\`.`);
    } else {
      const note = member.manageable ? '' : ' (Não consegui alterar o nickname automaticamente.)';
      return message.reply(`✅ Seu ID é **${assigned}**.${note}`);
    }
  }
});

// Interactions: botão, modal submit, approve/reject
client.on('interactionCreate', async (interaction) => {
  try {
    // botão abrir modal
    if (interaction.isButton() && interaction.customId === 'wl_apply') {
      const modal = new ModalBuilder().setCustomId('wl_modal').setTitle('Formulário de Whitelist');

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

    // modal submit
    if (interaction.isModalSubmit() && interaction.customId === 'wl_modal') {
      const nick = interaction.fields.getTextInputValue('wl_name');
      const motivo = interaction.fields.getTextInputValue('wl_why');
      const applicant = interaction.user;
      const appId = Date.now().toString();

      const appEmbed = new EmbedBuilder()
        .setTitle('Nova inscrição de WL')
        .addFields(
          { name: 'App ID', value: appId, inline: true },
          { name: 'Nick (declarado)', value: nick, inline: true },
          { name: 'Usuário', value: `${applicant.tag} (${applicant.id})`, inline: false },
          { name: 'Motivo', value: motivo }
        )
        .setFooter({ text: `Aplicante ID: ${applicant.id}` })
        .setTimestamp();

      const approveBtn = new ButtonBuilder().setCustomId(`wl_approve_${appId}`).setLabel('Aprovar').setStyle(ButtonStyle.Success);
      const rejectBtn = new ButtonBuilder().setCustomId(`wl_reject_${appId}`).setLabel('Reprovar').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

      let targetChannel = null;
      if (STAFF_CHANNEL_ID) {
        try {
          targetChannel = await interaction.guild.channels.fetch(STAFF_CHANNEL_ID);
        } catch (err) {
          console.error('Erro ao buscar staff channel:', err);
        }
      }
      if (!targetChannel) targetChannel = interaction.channel;

      const sent = await targetChannel.send({ embeds: [appEmbed], components: [row] });

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

    // approve / reject handlers
    if (interaction.isButton() && (interaction.customId.startsWith('wl_approve_') || interaction.customId.startsWith('wl_reject_'))) {
      if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ content: 'Você não tem permissão para isso.', ephemeral: true });
      }

      const isApprove = interaction.customId.startsWith('wl_approve_');
      const appId = interaction.customId.split('_').slice(2).join('_');
      const data = loadData();
      const app = data.applications[appId];
      if (!app) return interaction.reply({ content: 'Aplicação não encontrada.', ephemeral: true });
      if (app.status !== 'pending') return interaction.reply({ content: `Aplicação já processada: ${app.status}`, ephemeral: true });

      let member = null;
      try {
        member = await interaction.guild.members.fetch(app.applicantId);
      } catch (err) {
        console.error('Erro ao buscar membro:', err);
      }

      if (isApprove) {
        const assignedId = data.nextId || 1000;
        data.nextId = Number(data.nextId || 1000) + 1;

        if (WL_ROLE_ID && member) {
          try {
            await member.roles.add(WL_ROLE_ID, `Aprovado WL por ${interaction.user.tag}`);
          } catch (err) {
            console.error('Erro ao adicionar role WL:', err);
          }
        }

        if (member) {
          try {
            const baseName = member.nickname || member.user.username;
            const newNick = makeNickname(assignedId, baseName);
            if (member.manageable) await member.setNickname(newNick, `WL approved by ${interaction.user.tag}`);
          } catch (err) {
            console.error('Erro ao alterar nickname:', err);
          }
        }

        app.status = 'approved';
        app.assignedId = assignedId;
        app.approvedBy = interaction.user.id;
        app.approvedAt = new Date().toISOString();
        data.ids = data.ids || {};
        data.ids[app.applicantId] = assignedId;
        saveData(data);

        try {
          const msgChannel = await client.channels.fetch(app.channelId);
          const appMsg = await msgChannel.messages.fetch(app.messageId);
          const updatedEmbed = EmbedBuilder.from(appMsg.embeds[0])
            .setColor('#2ecc71')
            .addFields({ name: 'Status', value: `Aprovado por ${interaction.user.tag} — ID: ${assignedId}` });
          await appMsg.edit({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
          console.error('Erro ao atualizar mensagem da aplicação:', err);
        }

        await interaction.reply({ content: `Aplicação aprovada. ID atribuído: ${assignedId}`, ephemeral: true });

        try {
          const user = await client.users.fetch(app.applicantId);
          user.send(`Sua aplicação foi aprovada! Seu ID é ${assignedId}.`).catch(() => {});
        } catch (err) {}
      } else {
        app.status = 'rejected';
        app.rejectedBy = interaction.user.id;
        app.rejectedAt = new Date().toISOString();
        saveData(data);

        try {
          const msgChannel = await client.channels.fetch(app.channelId);
          const appMsg = await msgChannel.messages.fetch(app.messageId);
          const updatedEmbed = EmbedBuilder.from(appMsg.embeds[0])
            .setColor('#e74c3c')
            .addFields({ name: 'Status', value: `Reprovado por ${interaction.user.tag}` });
          await appMsg.edit({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
          console.error('Erro ao atualizar mensagem da aplicação:', err);
        }

        await interaction.reply({ content: 'Aplicação reprovada.', ephemeral: true });

        try {
          const user = await client.users.fetch(app.applicantId);
          user.send('Sua aplicação foi reprovada.').catch(() => {});
        } catch (err) {}
      }
      return;
    }
  } catch (err) {
    console.error('Erro no interactionCreate:', err);
  }
});

// Health server (Express)
const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Health server listening on port ${PORT}`);
});

// Start bot
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não definido no ambiente!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erro ao logar no Discord:', err);
  process.exit(1);
});