// id_botoes.js
// Handler de botões para atribuir ID e aplicar cargo "com id".
// CONFIG no topo — cole os IDs do Discord aqui.

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const CONFIG = {
  DATA_FILE: path.join(__dirname, 'data.json'),
  WL_ROLE_ID: '1537933883788763177' // cargo "com id" que será dado quando atribuir ID
};

let client;

function setup(localClient, options = {}) {
  client = localClient;
  if (options && options.DATA_FILE) CONFIG.DATA_FILE = options.DATA_FILE;
  if (options && options.WL_ROLE_ID) CONFIG.WL_ROLE_ID = options.WL_ROLE_ID;
}

function loadData() {
  if (!fs.existsSync(CONFIG.DATA_FILE)) {
    fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify({ nextId: 10, applications: {}, ids: {} }, null, 2));
  }
  const raw = fs.readFileSync(CONFIG.DATA_FILE, 'utf8') || '{}';
  try { return JSON.parse(raw); } catch { return { nextId: 10, applications: {}, ids: {} }; }
}
function saveData(data) { fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2)); }

function makeNick(id, name) {
  const base = `${id} | ${name}`;
  return base.length <= 32 ? base : base.slice(0, 32);
}

module.exports = {
  setup,
  handleInteraction: async function (interaction) {
    try {
      if (!interaction.isButton()) return false;
      const cid = interaction.customId;

      // Esperado: id_assign_<targetUserId>
      if (!cid.startsWith('id_assign_')) return false;

      // apenas staff (ManageGuild) pode usar este botão
      if (!interaction.member.permissions.has('ManageGuild')) {
        await interaction.reply({ content: 'Você não tem permissão para isso.', ephemeral: true });
        return true;
      }

      const targetUserId = cid.split('_').slice(2).join('_');
      const data = loadData();
      data.ids = data.ids || {};

      // atribui ID se não tiver
      let assigned = data.ids[targetUserId];
      if (!assigned) {
        assigned = data.nextId || 10;
        data.nextId = Number(assigned) + 1;
        data.ids[targetUserId] = assigned;
        saveData(data);
      }

      // aplica cargo WL_ROLE_ID (se configurado) e atualiza nickname
      try {
        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUserId);

        if (CONFIG.WL_ROLE_ID && CONFIG.WL_ROLE_ID !== 'COLE_AQUI_WL_ROLE_ID') {
          try { await member.roles.add(CONFIG.WL_ROLE_ID, `Assigned by ${interaction.user.tag}`); } catch (e) { console.error('Erro ao adicionar role WL_ROLE_ID', e); }
        }

        const newNick = makeNick(assigned, member.nickname || member.user.username);
        try {
          if (member.manageable) await member.setNickname(newNick, `Assigned ID by ${interaction.user.tag}`);
        } catch (e) {
          console.error('Não foi possível alterar nickname (hierarquia/permissões)', e);
        }
      } catch (err) {
        console.error('Erro ao aplicar cargo/nick no usuário alvo:', err);
      }

      await interaction.reply({ content: `ID ${assigned} atribuído ao usuário.`, ephemeral: true });
      return true;
    } catch (err) {
      console.error('id_botoes error', err);
      try { if (!interaction.replied) await interaction.reply({ content: 'Erro interno ao atribuir ID.', ephemeral: true }); } catch {}
      return true;
    }
  }
};