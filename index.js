const request = require('request');

module.exports = {
  defaultConfig: {
    enabled: false,
    apiKey: ''
  },
  defaultConfigDetails: {
    apiKey: { label: 'Siege-Summary API-Key (available on your Siege-Summary.com profile)', type: 'input' }
  },
  pluginName: 'SiegeSummaryPlugin',
  pluginDescription: 'Uploads siege matchup info and attack logs for Siege-Summary (siege-summary.com)',
  data: {},
  logged_data: { matchup_info: 0, attack_log: 0, defense_log: 0, defense_list: 0 },
  match_id: undefined,
  guild_name: undefined,
  init(proxy, config) {
    if(config.Config.Plugins[this.pluginName].apiKey == '') {
      proxy.log({ type: 'info', source: 'plugin', name: this.pluginName, message: "Please insert your API-Key to use the Plugin." });
    }else {
      proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: "Observing your Siege-Events." });
    }

    proxy.on('GetGuildSiegeMatchupInfo', (req, resp) => {
      if (config.Config.Plugins[this.pluginName].enabled && resp.ret_code === 0) {
        this.data['wizard_id'] = req.wizard_id;
        this.data['matchup_info'] = resp;
        this.logged_data.matchup_info = 1;
        this.match_id = resp.match_info.match_id;
        if (this.guild_name === undefined) {
          this.getGuildName(this.data);
        }
        this.writeSiegeMatchToFile(config, proxy, this.data);
      }
    });
    proxy.on('GetGuildSiegeBattleLog', (req, resp) => {
      if (config.Config.Plugins[this.pluginName].enabled) {
        let log_msg;
        if (req.log_type === 1) {
          this.data['attack_log'] = resp;
          this.logged_data.attack_log = 1;
          log_msg = 'attack log';
        } else {
          this.data['defense_log'] = resp;
          this.logged_data.defense_log = 1;
          log_msg = 'defense log';
        }
        this.match_id = resp.log_list[0].guild_info_list[0].match_id;
        this.writeSiegeMatchToFile(config, proxy, this.data);
      }
    });
    proxy.on('GetGuildSiegeBaseDefenseUnitList', (req, resp) => {
      if (config.Config.Plugins[this.pluginName].enabled) {
        if ([1, 14, 27].includes(req.base_number)) {
          this.data['defense_list'] = resp;
          this.data.defense_list.hq_base_number = req.base_number;
          this.logged_data.defense_list = 1;
          this.writeSiegeMatchToFile(config, proxy, this.data);
        }
      }
    });
    proxy.on('GetGuildSiegeBaseDefenseUnitListPreset', (req, resp) => {
      if (config.Config.Plugins[this.pluginName].enabled) {
        if ([1, 14, 27].includes(req.base_number)) {
          this.data['defense_list'] = resp;
          this.data.defense_list.hq_base_number = req.base_number;
          this.logged_data.defense_list = 1;
          this.writeSiegeMatchToFile(config, proxy, this.data);
        }
      }
    });
  },

  writeSiegeMatchToFile(config, proxy, data) {
    if (config.Config.Plugins[this.pluginName].apiKey !== '') {
      if (data.matchup_info !== undefined) {
        this.uploadSiegeToSS(config.Config.Plugins[this.pluginName].apiKey, data, proxy);
      } else {
        proxy.log({ type: 'warning', source: 'plugin', name: this.pluginName, message: "No ongoing siege, didn't upload the json." });
      }
    }
  },

  getGuildName(data){
    data.matchup_info.wizard_info_list.forEach(element => {
      if (element.wizard_id === data.wizard_id) {
        data.matchup_info.guild_list.forEach(innerelement => {
          if(innerelement.guild_id === element.guild_id) {
            this.guild_name = innerelement.guild_name; 
          }
        });
      }
    });
  },

  uploadSiegeToSS(pApiKey, data, proxy) {
    let dataModified = {
      apiKey: pApiKey,
      matchId: data.matchup_info.match_info.match_id,
      guildName: this.guild_name,
      fileText: JSON.stringify(data, true, 2),
      lastModified: Date.now()
    }
    let options = {
      method: 'post',
      uri: 'http://siege-summary.com/api/uploadSiegeByApi.php',
      headers: {
        'Application-Type': 'json',
        'CustomHeader': 'StepBroImStuck'
      },
      json: true,
      body: JSON.stringify(dataModified)
    }
    request(options, (error, response) => {
      if (error) {
        proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `HttpClient-Error: ${error.message}` });
        return;
      }
      if (response.body.status) {
        let tmpMessage = `<div>
                      Sucessfully uploaded!

                      Visit: <a href="http://siege-summary.com" target="_blank" rel="noopener noreferrer">Siege-Summary.com</a> to view your Siege.
                      </div>`;
        proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: tmpMessage });
      } else {
        let tmpMessage = `<div>
                      Oops, something went wrong! ${response.body.exception}
                      </div>`;
        proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: tmpMessage });
      }
    });
  }
};
