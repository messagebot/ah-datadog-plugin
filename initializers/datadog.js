if(process.env.DATADOG_API_KEY){

  const datadog = require('datadog-metrics');
  let timer;
  let timeout = 5 * 1000;

  module.exports = {
    initialize: function(api, next){
      let appName = api.config.general.serverName.replace(/\s/g, '-') + '-' + api.env;
      let host = api.id.replace(/\s/g, '-');

      api.datadog = new datadog.BufferedMetricsLogger({
        apiKey: process.env.DATADOG_API_KEY,
        host: host,
        prefix: `${appName}.`,
        flushIntervalSeconds: 15
      });

      /* Action Middleware */
      api.actions.addMiddleware({
        name: 'datadog action middleware',
        global: true,
        preProcessor: function(data, next){
          data.datadog = { startTime: (new Date()).getTime() }
          next();
        },
        postProcessor: function(data, next){
          let duration = ((new Date).getTime() - data.datadog.startTime) / 1000;
          api.datadog.histogram('actions._all.duration', duration);
          api.datadog.histogram(`actions.${data.params.action}.duration`, duration);
          next();
        }
      });

      /* Task Middleware */
      api.tasks.addMiddleware({
        name: 'datadog task middleware',
        global: true,
        preProcessor: function(next){
          let worker = this.worker;
          worker.datadog = { startTime: (new Date()).getTime() }
          next();
        },
        postProcessor: function(next){
          let worker = this.worker;
          let duration = ((new Date).getTime() - worker.datadog.startTime) / 1000;
          api.datadog.histogram('tasks._all.duration', duration);
          api.datadog.histogram(`tasks.${worker.job.class}.duration`, duration);
          next();
        }
      });

      return next();
    },

    start: function(api, next){
      let collectMemoryStats = function(){
        var memUsage = process.memoryUsage();
        api.datadog.gauge('memory.rss', memUsage.rss);
        api.datadog.gauge('memory.heapTotal', memUsage.heapTotal);
        api.datadog.gauge('memory.heapUsed', memUsage.heapUsed);
      };

      let collectTaskStats = function(){
        api.tasks.details((error, resque) => {
          if(error){ throw error; }
          let total = 0;
          Object.keys(resque.queues).forEach((q) => {
            let length = resque.queues[q].length;
            api.datadog.histogram(`resque.${q}.length`, length);
            total = total  + length;
          });
          api.datadog.histogram(`resque._all.length`, total);
        });
      };

      timer = setInterval(() => {
        collectMemoryStats();
        collectTaskStats();
      }, timeout);

      return next();
    },

    stop: function(api, next){
      clearInterval(timer);
      return next();
    }
  };

}
