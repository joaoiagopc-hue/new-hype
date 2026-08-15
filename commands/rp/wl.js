// wl.js
// Painel de Whitelist (embed + botão). O botão tem customId 'wl_iniciar' — o handler do quiz está em wl_botoes.js.
// EDITE o bloco CONFIG se quiser sobrescrever via setup.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CONFIG = {
  BANNER_IMAGE: 'https://cdn.discordapp.com/attachments/1519870266216288270/1538184654685872159/content.png?ex=6a81c197&is=6a807017&hm=772d974e71beed13fd1e66ff87c314805c813e344414134860a2c129ba2feb7e&', // opcional URL de banner que aparece no embed (deixe vazia para não exibir)
  PANEL_TITLE: 'HYPE WHITELIST'
};

let client;

function setup(localClient, overrides = {}) {
  client = localClient;
  Object.assign(CONFIG, overrides);
}

async function onPainelCommand(message) {
  try {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.reply({ content: 'Você precisa da permissão Gerenciar Servidor para usar este comando.', ephemeral: true });
    }

    // apaga painéis antigos com o mesmo título postados pelo bot
    try {
      const msgs = await message.channel.messages.fetch({ limit: 100 });
      const botMsgs = msgs.filter(m => m.author?.id === client.user.id && m.embeds?.[0]?.title === CONFIG.PANEL_TITLE);
      for (const m of botMsgs.values()) await m.delete().catch(() => {});
    } catch (err) {
      console.error('Erro apagando painéis antigos:', err);
    }

    const embed = new EmbedBuilder()
      .setTitle(CONFIG.PANEL_TITLE)
      .setDescription('Clique em **Iniciar WL** para fazer o quiz de whitelist. Suas perguntas e respostas serão privadas (apenas você verá).')
      .setColor('#0a090e');

    if (CONFIG.BANNER_IMAGE) embed.setImage(CONFIG.BANNER_IMAGE);

    embed.addFields({ name: 'Informações', value: 'O quiz possui 7 perguntas. Você precisa acertar pelo menos 4 para ser aprovado.' });

    const btn = new ButtonBuilder().setCustomId('wl_iniciar').setLabel('Iniciar WL').setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(btn);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.reply({ content: 'Painel de WL enviado.', ephemeral: true });
  } catch (err) {
    console.error('onPainelCommand error', err);
    return message.reply({ content: 'Erro ao enviar painel de WL.', ephemeral: true });
  }
}

module.exports = { setup, onPainelCommand, CONFIG };