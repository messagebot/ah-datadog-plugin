# AH-DATADOG-PLUGIN

## Install

- `npm install ah-datadog-plugin`
- `./node_modules/.bin/actionhero link --name ah-datadog-plugin`

We use the awesome `datadog-metrics` package.  Note: while we might be *instructing* the package to send data very often, it will actually buffer the data and send it in batches.  A datadog-agent is not required, we talk directly to the datadog API! 

## Requirements

- Ensure that `DATADOG_API_KEY` is set in your Environment (this is the only config)

## Data

All metrics are prefixed automatically by `appName` and `host` where:

```js
let appName = api.config.general.serverName.replace(/\s/g, '-') + '-' + api.env;
let host = api.id.replace(/\s/g, '-');
```

### Memory

We will report the following every 5 seconds:

```js
var memUsage = process.memoryUsage();
datadog.gauge('memory.rss', memUsage.rss);
datadog.gauge('memory.heapTotal', memUsage.heapTotal);
datadog.gauge('memory.heapUsed', memUsage.heapUsed);
```

### Resque:

We will report the following (queue lengths) every 5 seconds from resque/Tasks

```js
datadog.histogram(`resque.${q}.length`, length); // 'q' is the name of the queue
datadog.histogram(`resque._all.length`, total);

```

### Actions

We will report the following at the end of every action

```js
datadog.histogram('actions._all.duration', duration);
datadog.histogram(`actions.${data.params.action}.duration`, duration);
```

We will report the following every minute

```js
datadog.gauge('actions.per_minute', actionCounter);
```

### Tasks

We will report the following at the end of every task

```js
datadog.histogram('tasks._all.duration', duration);
datadog.histogram(`tasks.${worker.job.class}.duration`, duration);
```

We will report the following every minute

```js
datadog.gauge('tasks.per_minute', actionCounter);
```
