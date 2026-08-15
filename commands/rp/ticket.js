// commands/rp/ticket.js
// Painel HYPE de tickets — BOTÕES (Denúncia / Suporte / Compras)

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CONFIG = {
  PANEL_TITLE: 'Atendimento HYPE',
  BANNER_IMAGE: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538186432072392844/content.png?ex=6a81c33f&is=6a8071bf&hm=8f79d661093d4e5e3ea4b0d7f756eceaeb40fe4cdb6441781566b21bfc6250d3&' // opcional
};

let client;
function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function onTicketCommand(message) {
  try {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa da permissão "Gerenciar Servidor" para postar o painel de atendimento.', ephemeral: true });
    }

    // limpa painéis antigos
    try {
      const msgs = await message.channel.messages.fetch({ limit: 100 });
      const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === CONFIG.PANEL_TITLE);
      for (const m of botMsgs.values()) await m.delete().catch(()=>{});
    } catch (err) {
      console.warn('Aviso ao apagar painéis antigos (não bloqueante):', err?.message || err);
    }

    const embed = new EmbedBuilder()
      .setTitle(CONFIG.PANEL_TITLE)
      .setDescription('Precisa de ajuda? Clique em um dos botões abaixo para abrir um ticket: Denúncia, Suporte ou Compras. Apenas você e a staff terão acesso ao ticket.')
      .setColor('#0c0c0c')
      .setFooter({ text: 'Clique no tipo de atendimento e seu ticket será aberto automaticamente.' });

    if (CONFIG.BANNER_IMAGE) embed.setImage(CONFIG.BANNER_IMAGE);

    const btnDenuncia = new ButtonBuilder().setCustomId('ticket_open_denuncia').setLabel('Denúncia').setStyle(ButtonStyle.Danger).setEmoji('🚨');
    const btnSuporte = new ButtonBuilder().setCustomId('ticket_open_suporte').setLabel('Suporte').setStyle(ButtonStyle.Primary).setEmoji('🎯');
    const btnCompras = new ButtonBuilder().setCustomId('ticket_open_compras').setLabel('Compras').setStyle(ButtonStyle.Success).setEmoji('🛒');

    const row = new ActionRowBuilder().addComponents(btnDenuncia, btnSuporte, btnCompras);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de atendimento HYPE enviado.', ephemeral: true });
  } catch (err) {
    console.error('onTicketCommand error:', err && err.stack ? err.stack : err);
    return message.reply({ content: 'Erro ao enviar painel de tickets.', ephemeral: true });
  }
}

module.exports = { setup, onTicketCommand, CONFIG };