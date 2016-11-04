if(process.env.DATADOG_API_KEY){

  const datadog = require('datadog-metrics');
  let memoryTimer;
  let memoryTimeout = 5 * 1000;
  let minuteTimer;
  let minuteTimeout = 60 * 1000;
  let actionCounter = 0;
  let taskCounter = 0;

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
          actionCounter++;
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
          taskCounter++;
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

      let minuteCounter = function(){
        api.datadog.gauge('actions.per_minute', actionCounter);
        api.datadog.gauge('tasks.per_minute', taskCounter);
        actionCounter = 0;
        taskCounter = 0;
      }

      memoryTimer = setInterval(() => {
        collectMemoryStats();
        collectTaskStats();
      }, memoryTimeout);

      minuteTimer = setInterval(() => {
        minuteCounter();
      }, minuteTimeout);


      api.log('logging metrics from this application to datadog');
      return next();
    },

    stop: function(api, next){
      clearInterval(memoryTimer);
      clearInterval(minuteTimer);
      return next();
    }
  };

}
