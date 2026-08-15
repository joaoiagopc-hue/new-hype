// index.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const { Client, GatewayIntentBits, Partials } = require('discord.js');

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

// imports - ajuste caminhos se sua estrutura for diferente
const wl = require('./commands/rp/wl');                     // opcional: se tiver
const wlButtons = require('./commands/admin/wl_botoes');    // opcional
const idModule = require('./commands/rp/id');               // opcional
const idButtons = require('./commands/admin/id_botoes');    // opcional
const ticket = require('./commands/rp/ticket');
const ticketButtons = require('./commands/admin/ticket_botoes');
const quickTeste = require('./commands/admin/quick-teste');

const commonOptions = { DATA_FILE };

// try setup modules if exist
try { wl && wl.setup && wl.setup(client, commonOptions); } catch (e) { console.warn('wl.setup failed', e); }
try { wlButtons && wlButtons.setup && wlButtons.setup(client, commonOptions); } catch (e) { console.warn('wl_botoes.setup failed', e); }
try { idModule && idModule.setup && idModule.setup(client, commonOptions); } catch (e) { console.warn('id.setup failed', e); }
try { idButtons && idButtons.setup && idButtons.setup(client, commonOptions); } catch (e) { console.warn('id_botoes.setup failed', e); }
try { ticket.setup && ticket.setup(client, commonOptions); } catch (e) { console.warn('ticket.setup failed', e); }
try { ticketButtons && ticketButtons.setup && ticketButtons.setup(client, commonOptions); } catch (e) { console.warn('ticket_botoes.setup failed', e); }

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// prefix commands
const PREFIX = '!';
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'painel-ticket' || cmd === 'ticket') {
    try { await ticket.onTicketCommand(message); } catch (err) { console.error('onTicketCommand error', err); }
    return;
  }

  if (cmd === 'test-channel' || cmd === 'test-channel') {
    try { await quickTeste.run(message); } catch (err) { console.error('quick-teste error', err); }
    return;
  }

  if (cmd === 'id') {
    try { idModule && idModule.onIdCommand && idModule.onIdCommand(message); } catch (err) { console.error('onIdCommand error', err); }
    return;
  }
});

// interaction routing + improved error logging
client.on('interactionCreate', async (interaction) => {
  try {
    if (await (wlButtons && wlButtons.handleInteraction ? wlButtons.handleInteraction(interaction) : false)) return;
    if (await (idButtons && idButtons.handleInteraction ? idButtons.handleInteraction(interaction) : false)) return;
    if (await (ticketButtons && ticketButtons.handleInteraction ? ticketButtons.handleInteraction(interaction) : false)) return;
  } catch (err) {
    // log completo no console
    console.error('interactionCreate error:', {
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      interactionType: interaction?.type,
      customId: interaction?.customId || null,
      userId: interaction?.user?.id || null,
      guildId: interaction?.guild?.id || null,
      time: new Date().toISOString()
    });

    // Notifica apenas canal de staff (se configurado)
    try {
      const tb = require('./commands/admin/ticket_botoes');
      const staffChanId = tb && tb.CONFIG && tb.CONFIG.STAFF_CHANNEL_ID ? tb.CONFIG.STAFF_CHANNEL_ID : null;
      if (staffChanId && staffChanId !== 'COLE_AQUI_STAFF_CHANNEL_ID') {
        const ch = await client.channels.fetch(staffChanId).catch(()=>null);
        if (ch) {
          const shortMsg = `⚠️ Erro interno detectado: ${err && err.message ? err.message : 'ver console'}`;
          await ch.send({ content: shortMsg }).catch(()=>{});
        }
      }
    } catch (e) { /* ignore */ }

    try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno.', ephemeral: true }); } catch (e) { /* ignore */ }
  }
});

// health server (Render)
const app = express();
app.get('/health', (req, res) => res.status(200).send('OK'));
http.createServer(app).listen(process.env.PORT ? Number(process.env.PORT) : 3000, () => {
  console.log('Health server listening');
});

// login
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN não definido no ambiente!');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Erro ao logar no Discord:', err);
  process.exit(1);
});