/* index.js
   Entrypoint que integra comandos por prefixo e handlers de interações (botões/modals).
   Também expõe /health para UptimeRobot / Render.
*/

require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Health endpoint
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Health server listening on port ${PORT}`));

// Import handlers (certifique-se que esses arquivos existem nos caminhos)
const idModule = require('./commands/rp/id');
const idButtons = require('./commands/admin/id_botoes');
const wlCommand = require('./commands/rp/wl');
const wlButtons = require('./commands/admin/wl_botoes');
const ticketPanel = require('./commands/rp/ticket');
const ticketButtons = require('./commands/admin/ticket_botoes');

// Intents: usamos MessageContent porque os comandos aqui são por prefixo (!id, !painel-wl, !painel-ticket)
// e GuildMembers para operar roles (fetch member). Habilite essas intents no Developer Portal se necessário.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Mensagens por prefixo
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content.trim();

    if (content === '!id') {
      return idModule.handleIdCommand(message);
    }

    if (content === '!painel-wl') {
      return wlCommand.handlePainelCommand(message);
    }

    if (content === '!painel-ticket') {
      return ticketPanel.handlePanelCommand(message);
    }

    // Adicione outros prefixos aqui se quiser
  } catch (err) {
    console.error('Erro em messageCreate:', err);
  }
});

// Interações (botões / modals)
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      // encaminha para os handlers que checam customId
      await wlButtons.handleInteraction(interaction).catch(() => null);
      await ticketButtons.handleInteraction(interaction).catch(() => null);
      await idButtons.handleButtonInteraction(interaction).catch(() => null);
      return;
    }

    if (interaction.isModalSubmit && typeof ticketButtons.handleModalSubmit === 'function') {
      await ticketButtons.handleModalSubmit(interaction).catch((e) => {
        console.error('Erro no modal submit:', e);
      });
      return;
    }

    // outros tipos de interação (slash etc) podem ser adicionados aqui
  } catch (err) {
    console.error('Erro em interactionCreate:', err);
  }
});

// good practices: log de rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// start bot
if (!process.env.DISCORD_TOKEN) {
  console.error('ERRO: DISCORD_TOKEN não definido em .env ou variáveis de ambiente.');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('Falha ao logar o bot:', err);
  process.exit(1);
});