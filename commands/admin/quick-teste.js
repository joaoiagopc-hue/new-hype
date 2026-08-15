// commands/admin/quick-test.js
// Comando de diagnóstico: tenta criar um canal de texto rápido para testar permissões do bot.
// Uso: no index.js adicione: if (cmd === 'test-channel') require('./commands/admin/quick-test').run(message);

module.exports = {
  run: async (message) => {
    try {
      if (!message.guild) return message.reply({ content: 'Use este comando dentro do servidor.', ephemeral: true });
      const guild = message.guild;

      // verifica permissão do bot
      const botMember = guild.members.me || await guild.members.fetch(message.client.user.id).catch(()=>null);
      if (!botMember) return message.reply({ content: 'Não consegui obter o membro do bot no servidor (ver logs).', ephemeral: true });

      if (!botMember.permissions.has('ManageChannels')) {
        return message.reply({ content: 'O bot não tem a permissão "Gerenciar Canais". Peça ao admin para dar essa permissão e tente novamente.', ephemeral: true });
      }

      // tenta criar canal de teste
      const name = `test-create-${Date.now().toString().slice(-4)}`;
      const channel = await guild.channels.create({
        name,
        type: 0 // GuildText
      }).catch(err => {
        console.error('quick-test: erro ao criar canal:', err && err.stack ? err.stack : err);
        throw err;
      });

      // responde com sucesso (e deleta o canal após 10s para não poluir)
      await message.reply({ content: `Canal de teste criado: ${channel} — será removido em 10s`, ephemeral: true });
      setTimeout(async () => {
        try { await channel.delete('cleanup quick-test'); } catch (e) { console.error('quick-test: erro ao deletar canal:', e && e.stack ? e.stack : e); }
      }, 10000);

    } catch (err) {
      console.error('quick-test run error:', err && err.stack ? err.stack : err);
      try { await message.reply({ content: 'Erro ao executar quick-test. Veja logs do bot para detalhes.', ephemeral: true }); } catch {}
    }
  }
};