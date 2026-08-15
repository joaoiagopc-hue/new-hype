// commands/admin/quick-teste.js
// Comando de diagnóstico: testa se o bot consegue criar um canal.

module.exports = {
  run: async (message) => {
    try {
      if (!message.guild) return message.reply({ content: 'Use este comando dentro do servidor.', ephemeral: true });

      const guild = message.guild;
      const botMember = guild.members.me || await guild.members.fetch(message.client.user.id).catch(()=>null);
      if (!botMember) return message.reply({ content: 'Não consegui obter o membro do bot no servidor (veja logs).', ephemeral: true });

      if (!botMember.permissions.has('ManageChannels')) {
        return message.reply({ content: 'O bot não tem a permissão "Gerenciar Canais". Peça ao admin para dar essa permissão e tente novamente.', ephemeral: true });
      }

      const name = `test-create-${Date.now().toString().slice(-4)}`;
      const channel = await guild.channels.create({
        name,
        type: 0 // GuildText
      }).catch(err => {
        console.error('quick-teste: erro ao criar canal:', err && err.stack ? err.stack : err);
        throw err;
      });

      await message.reply({ content: `Canal de teste criado: ${channel} — será removido em 10s`, ephemeral: true });
      setTimeout(async () => {
        try { await channel.delete('cleanup quick-teste'); } catch (e) { console.error('quick-teste: erro ao deletar canal:', e && e.stack ? e.stack : e); }
      }, 10000);

    } catch (err) {
      console.error('quick-teste run error:', err && err.stack ? err.stack : err);
      try { await message.reply({ content: 'Erro ao executar quick-teste. Veja logs do bot para detalhes.', ephemeral: true }); } catch {}
    }
  }
};