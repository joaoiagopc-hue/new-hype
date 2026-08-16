// commands/rp/criar_embed.js
// !criar -> bot pede "mande a msg que deseja coloca no embed cor preta"
// depois pega a próxima mensagem do autor, envia embed preto com esse conteúdo,
// apaga a mensagem do autor e a mensagem de comando, deixando apenas o embed.

const { EmbedBuilder } = require('discord.js');

module.exports = {
  run: async (message) => {
    try {
      if (!message.guild) return message.reply({ content: 'Use este comando dentro do servidor.', ephemeral: true });

      // pede para o usuário mandar a mensagem
      const prompt = await message.reply({ content: 'Mande a mensagem que deseja colocar no embed (cor preta). Você tem 60s.', fetchReply: true });

      const filter = m => m.author.id === message.author.id;
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }).catch(() => null);

      if (!collected || collected.size === 0) {
        await prompt.delete().catch(()=>{});
        return message.reply({ content: 'Tempo esgotado. Execute !criar novamente quando quiser.', ephemeral: true });
      }

      const userMsg = collected.first();

      const embed = new EmbedBuilder()
        .setDescription(userMsg.content || '[sem conteúdo de texto]')
        .setColor('#000000')
        .setFooter({ text: `Criado por ${message.author.tag}` });

      // envia embed e apaga o comando e a mensagem do usuário
      const sent = await message.channel.send({ embeds: [embed] }).catch(err => {
        console.error('Erro enviando embed:', err && err.stack ? err.stack : err);
      });

      // tenta apagar: prompt (bot reply), comando original e a mensagem do usuário
      try { await prompt.delete().catch(()=>{}); } catch {}
      try { if (message.deletable) await message.delete().catch(()=>{}); } catch {}
      try { if (userMsg.deletable) await userMsg.delete().catch(()=>{}); } catch {}

      // se possível, adiciona reação de confirmação no embed
      try { if (sent && sent.id) await sent.react('✅').catch(()=>{}); } catch {}
    } catch (err) {
      console.error('criar_embed error:', err && err.stack ? err.stack : err);
      try { await message.reply({ content: 'Erro ao criar embed. Veja logs.', ephemeral: true }); } catch {}
    }
  }
};