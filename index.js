// index.js (atualizado — inclui assistente_botoes e criar_embed handlers + comandos de moderação simples)
// Substitua o seu index.js pelo conteúdo abaixo (ou integre as partes relevantes).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [ Partials.Channel ]
});

// robust error handlers + heartbeat
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at: Promise', p, 'reason:', reason && (reason.stack || reason));
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err && (err.stack || err));
});
setInterval(() => console.log('[heartbeat] process running at', new Date().toISOString()), 5 * 60 * 1000);

// imports
const assist = require('./commands/admin/assistente_botoes');
const criarEmbed = require('./commands/rp/criar_embed');

try { assist.setup(client); } catch (e) { console.warn('assist setup failed', e); }

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// health server
const app = express();
app.get('/health', (_req, res) => res.status(200).send('OK'));
http.createServer(app).listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
  console.log('Health server listening');
});

// prefix command handler
const PREFIX = '!';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // painel assistente (envia o painel com buttons)
  if (cmd === 'painel-assistente' || cmd === 'assistente-painel') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ content: 'Você precisa da permissão "Gerenciar Servidor" para postar o painel.', ephemeral: true });
    }
    try {
      await assist.createPanel(message.channel);
      return message.reply({ content: 'Painel assistente publicado.', ephemeral: true });
    } catch (err) {
      console.error('Erro criando painel assistente:', err && err.stack ? err.stack : err);
      return message.reply({ content: 'Erro ao criar painel.', ephemeral: true });
    }
  }

  // criar embed (fluxo pedido)
  if (cmd === 'criar') {
    try { await criarEmbed.run(message); } catch (e) { console.error('criar_embed error', e); }
    return;
  }

  // mutar via comando: !mutar @user
  if (cmd === 'mutar') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply({ content: 'Permissão Manage Roles necessária.', ephemeral: true });
    const userText = args[0];
    if (!userText) return message.reply({ content: 'Use: !mutar @usuario', ephemeral: true });
    const id = userText.replace(/[<@!>]/g, '').trim();
    const member = await message.guild.members.fetch(id).catch(()=>null);
    if (!member) return message.reply({ content: 'Usuário não encontrado.', ephemeral: true });

    // ensure Muted role exists
    let muted = message.guild.roles.cache.find(r => r.name === 'Muted');
    if (!muted) {
      try {
        muted = await message.guild.roles.create({ name: 'Muted', reason: 'Criado pelo bot para mutar' });
        for (const [, ch] of message.guild.channels.cache) {
          try {
            await ch.permissionOverwrites.create(muted, { SendMessages: false, AddReactions: false }).catch(()=>{});
          } catch {}
        }
      } catch (e) {
        console.error('Erro criando Muted role:', e && e.stack ? e.stack : e);
        return message.reply({ content: 'Erro criando cargo Muted. Verifique permissões do bot.', ephemeral: true });
      }
    }

    try {
      await member.roles.add(muted, `Mutado por ${message.author.tag}`);
      const e = new EmbedBuilder().setTitle('Usuário mutado').setDescription(`<@${member.id}> foi mutado.`).setColor('#000000');
      return message.channel.send({ embeds: [e] });
    } catch (e) {
      console.error('Erro ao mutar via comando:', e && e.stack ? e.stack : e);
      return message.reply({ content: 'Erro ao mutar usuário. Verifique permissões.', ephemeral: true });
    }
  }

  // desmutar
  if (cmd === 'desmutar') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply({ content: 'Permissão Manage Roles necessária.', ephemeral: true });
    const userText = args[0];
    if (!userText) return message.reply({ content: 'Use: !desmutar @usuario', ephemeral: true });
    const id = userText.replace(/[<@!>]/g, '').trim();
    const member = await message.guild.members.fetch(id).catch(()=>null);
    if (!member) return message.reply({ content: 'Usuário não encontrado.', ephemeral: true });

    const muted = message.guild.roles.cache.find(r => r.name === 'Muted');
    if (!muted) return message.reply({ content: 'Cargo Muted não encontrado.', ephemeral: true });

    try {
      await member.roles.remove(muted, `Desmutado por ${message.author.tag}`);
      const e = new EmbedBuilder().setTitle('Usuário desmutado').setDescription(`<@${member.id}> foi desmutado.`).setColor('#000000');
      return message.channel.send({ embeds: [e] });
    } catch (err) {
      console.error('Erro ao desmutar via comando:', err && err.stack ? err.stack : err);
      return message.reply({ content: 'Erro ao desmutar usuário. Verifique permissões.', ephemeral: true });
    }
  }

  // apagar mensagens: !apagar 100
  if (cmd === 'apagar') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply({ content: 'Permissão Manage Messages necessária.', ephemeral: true });
    const n = Math.min(100, Math.max(1, parseInt(args[0], 10) || 0));
    if (n <= 0) return message.reply({ content: 'Use: !apagar <quantidade> (1-100)', ephemeral: true });
    try {
      const deleted = await message.channel.bulkDelete(n, true);
      const e = new EmbedBuilder().setTitle('Mensagens apagadas').setDescription(`Foram apagadas ${deleted.size} mensagens.`).setColor('#000000');
      return message.channel.send({ embeds: [e] }).then(msg => setTimeout(() => msg.delete().catch(()=>{}), 8000));
    } catch (err) {
      console.error('Erro bulkDelete:', err && err.stack ? err.stack : err);
      return message.reply({ content: 'Erro ao apagar mensagens (mensagens com mais de 14 dias não podem ser apagadas em lote).', ephemeral: true });
    }
  }

  // ajuda
  if (cmd === 'ajuda') {
    const e = new EmbedBuilder()
      .setTitle('Ajuda — HYPE Assistente')
      .setDescription('Comandos disponíveis:\n\n• `!mutar @user`\n• `!desmutar @user`\n• `!apagar <n>`\n• `!criar` — criar embed\n• `!painel-assistente` — posta painel com botões')
      .setColor('#000000');
    return message.channel.send({ embeds: [e] });
  }
});

// interaction routing (buttons/modals)
client.on('interactionCreate', async (interaction) => {
  try {
    if (await assist.handleInteraction(interaction)) return;
    // other handlers...
  } catch (err) {
    console.error('interactionCreate error:', err && err.stack ? err.stack : err);
    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno.', ephemeral: true }); } catch {}
  }
});

// login
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não definido!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erro ao logar no Discord:', err && err.stack ? err.stack : err);
  process.exit(1);
});