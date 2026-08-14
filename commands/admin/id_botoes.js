/* commands/admin/id_botoes.js */
const dataStore = require('../../dataStore');

/*
  CONFIG - apenas referência (cole nos outros arquivos também se quiser)
*/
const CONFIG = {
  ID_ROLE_ID: '1537933883788763177'
};

const ID_ROLE_ID = CONFIG.ID_ROLE_ID && !CONFIG.ID_ROLE_ID.startsWith('COLOQUE') ? CONFIG.ID_ROLE_ID : process.env.ID_ROLE_ID;

async function handleButtonInteraction(interaction) {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'ver_id') {
    const data = dataStore.load();
    const userData = data.users[interaction.user.id];
    if (!userData) {
      return interaction.reply({ content: 'Você ainda não tem ID registrado. Use `!id` para registrar.', ephemeral: true });
    }
    return interaction.reply({ content: `Seu ID: **${userData.id}** | ${userData.nick}`, ephemeral: true });
  }
}

module.exports = { handleButtonInteraction };