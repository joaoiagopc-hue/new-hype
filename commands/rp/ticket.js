// ticket.js
// Painel de tickets — posts com botões para abrir tickets (ticket_botoes.js trata a lógica).
// EDITE CONFIG se quiser.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CONFIG = {
  PANEL_TITLE: 'HYPE TICKET',
  BANNER_IMAGE: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538186432072392844/content.png?ex=6a81c33f&is=6a8071bf&hm=8f79d661093d4e5e3ea4b0d7f756eceaeb40fe4cdb6441781566b21bfc6250d3&' // opcional: URL da imagem do painel
};

let client;

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function onTicketCommand(message) {
  try {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa da permissão Gerenciar Servidor para postar o painel de tickets.', ephemeral: true });
    }

    // Apaga painéis antigos com o mesmo título
    try {
      const msgs = await message.channel.messages.fetch({ limit: 100 });
      const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === CONFIG.PANEL_TITLE);
      for (const m of botMsgs.values()) await m.delete().catch(() => {});
    } catch (err) {
      console.error('Erro apagar painéis tickets:', err);
    }

    const embed = new EmbedBuilder()
      .setTitle(CONFIG.PANEL_TITLE)
      .setDescription('Nossa equipe está pronta para ajudar. Selecione o tipo de ticket abaixo para abrir.')
      .setColor('#0d0a0e');

    if (CONFIG.BANNER_IMAGE) embed.setImage(CONFIG.BANNER_IMAGE);

    embed.addFields(
      { name: 'Denúncias', value: 'Denunciar usuários', inline: true },
      { name: 'Dúvidas', value: 'Perguntas gerais', inline: true },
      { name: 'Outros', value: 'Outros assuntos', inline: true }
    );

    const btn1 = new ButtonBuilder().setCustomId('ticket_open_denuncia').setLabel('Denúncia').setStyle(ButtonStyle.Danger);
    const btn2 = new ButtonBuilder().setCustomId('ticket_open_duvida').setLabel('Dúvida').setStyle(ButtonStyle.Primary);
    const btn3 = new ButtonBuilder().setCustomId('ticket_open_outros').setLabel('Outros').setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(btn1, btn2, btn3);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de tickets enviado.', ephemeral: true });
  } catch (err) {
    console.error('onTicketCommand error', err);
    return message.reply({ content: 'Erro ao enviar painel de tickets.', ephemeral: true });
  }
}

module.exports = { setup, onTicketCommand, CONFIG };