+++
title = 'Writing a simple scheduler for a Discord bot'
date = 2021-08-17T18:54:43+02:00
draft = false
tags = ['discord', 'backend']
images = ['https://storage.ko-fi.com/cdn/useruploads/display/7f6f85de-10e4-419e-933c-d9ea473451e7_screenshot2021-08-16at12.24.33.png']
+++

{{<figure src="https://storage.ko-fi.com/cdn/useruploads/display/7f6f85de-10e4-419e-933c-d9ea473451e7_screenshot2021-08-16at12.24.33.png">}}


While I was working on some recent additions to some Discord bots written in JavaScript I stumbled upon the demand for a way to schedule messages or actions.

Such actions can be the refresh of some counters after a given period or the check for due dates to send out notifications etc. Sure, you can utilise built-in functions like setTimeout or setInterval for each action but you end up with a bunch..or sometimes even a hell lot of timers running continuously at the same time, **what a waste !**

One way to address this was to write a global scheduler that is taking care of all upcoming actions to dispatch. Once added to the package, actions or tasks can be pushed to the scheduler. But where should the scheduler know what to do or..when?

The first step is to write a reliable model for our tasks. In TypeScript I would start with an interface leading into a class. Since we're doing this with regular JavaScript (es6) we're using classes for this. Let's think about what information our task should keep. When we think of planned messages, we definitely need a due date for the task. We also need the scheduler for recurring tasks that cycle after a given time...e.g. checking for a changed member count every 5min..so let's say we need a set timeout for each run. A name for later identification of the task would be beneficial. Finally we need to throw a function into the task, an action to run when the time has reached and the task will get executed. This function, a callback, needs to be as abstract as possible for our different use cases. Abstract ? Additional parameters ! we need to be able to push parameter values to that function for context and we don't want to restrict the amount of possible parameters. This has some drawbacks that I'll describe later...

We can write this down to a list of properties our task model needs: *name, due date, timeout, callback, parameters* !

This results in the following JavaScript representation.
```js
class Task {
    constructor(name, callback, timeout, duedate, ...params) {
        this.name = name;
        this.duedate = duedate;
        this.timeout = timeout;
        this.callback = callback;

        this.params = params;
    }
}
```

So far our Model only has a constructor that's setting the values for our properties. It's definitely not perfect and I'm open for suggestions !

Who's asking why there are three dots in front of the `params` parameter? The functionality is called Rest Parameter, `params` will put every variable given after duedate into an array with the variable name `params`. This way we can throw as many parameters into the callback function as we want and can access them through the `params` array.

To encapsulate the properties of our model we add so called Setters and Getters. We'll also take care of any "input validation" in those Setter-methods. We also have to take care of the fact, that we can add a due date and a timeout to the task...but wait ! A due date suggests that we run it once, a timeout suggests, that we run it multiple times with a given time in between. I haven't add any functionality yet what happens if you add both. 

Right now, the due date will be ignored. I can think of a first time to run the function and repeat it after ? If that makes sense :D

Let's move on to the scheduler module that takes care of the given tasks. We need something to add tasks to the scheduler and..obviously.. something to save them in RAM. A Map should be perfect since it's more flexible than an Object and more reliable than an Array. We also want to remove "dead" tasks from our storage. We only have to decide where the decision process of when a tasks callback should be executed takes place. Either the scheduler or the model is more intelligent. I decided to move away from the idea of a stupid model and gave the model itself more brain cells :P 

```js
const tasks = new Map();

const checkForTasks = () => {
    for ([name, task] of tasks) {
        task.run();
        if (task.getDuedate() === undefined && task.getTimeout() === undefined) {
            tasks.delete(name);
        }
    }
}

module.exports.addTask = (task) => {
    tasks.set(task.name, task)
}
```

The first line is our Map `tasks` that will keep all our tasks we push to the scheduler in memory. The last function, exported as `addTask` accepts a Task instance and add it to the Map via `.set(key, value)`. Note the name property that we add as the key for later identification of the Task :3

The scheduler will run the function `checkForTasks` that cycles through all saved tasks and call a `.run()` method of a Task instance. But wait ! We never defined any `.run()` method in our Task model ! Remember how I said I gave it some brain cells ? We gonna get back to it in a few.

After we called `.run()` we're checking our Getter-Methods of the timeout and due date properties if the return values are both `undefined` and if so, we strike the task from our memory. We could also expose another property whether to call the task again or that its done..but we're working with already existing Getters so why not utilise them. It's a free world and if you need help implementing a different way, feel free to ask in the comments !

Now that we know how tasks get added, called and removed from the scheduler, let's finally take a look at the more intelligent model again.

```js
...
setDuedate(duedate) {
    this.duedate = duedate;
    this.nextCall = duedate;
}
getDuedate() {
    return this.duedate;
}

setTimeout(timeout) {
    this.timeout = timeout;
    this.nextCall = Date.now() + timeout;
}
getTimeout() {
    return this.timeout;
}

run() {
    if (this.timeout && Date.now() >= this.nextCall) {
        this.callback(this.params);
        this.setTimeout(this.timeout);
    } else if (this.duedate && Date.now() >= this.nextCall) {
        this.callback(this.params);
        this.setDuedate(undefined);
    }
}
```

The first four methods are our Getters and Setters for the properties timeout and `duedate`. Note that there is another property called `nextCall` which saves the timestamp on when to run the callable the next time. 

This way we don't have to check the timeout or the due date (for the sake of when to run it). For the Due date we simply set it the same value as the `duedate` property. For the timeout, we want to run the callback from now on after time x: Now..the current time as timestamp is the return value of `Date.now()` returning the amount of Milliseconds that have passed since January 1st 1970. Epic. We just add the `timeout` value to it and we have the ***timestamp*** of our **next call**.

Finally the `run()` method that gets called by our scheduler. At first we want to know if we have to take care of a timeout-Task or a due date-Task by checking the property for the value `undefined`. This lives by the assumption that we put the other property (either `timeout` or `duedate`) to `undefined` via our Getters/Setters. If we want to have both, recapturing the idea from above, we would have to add the `duedate` to the timeout instead of the timestamp of the current time in the Setter- method. Second we check if the current timestamp (via `Date.now()`) is greater or equal the nextCall property of our Task. Depending on the check cycle of our scheduler the odds are high that we check it after the Tasks wants to be executed. Last we reset the due date / timeout via the Setter-method to also reassign the `nextCall` value. In case of the due date we set it to `undefined` since it's supposed to be a one-time only event. 

*(It's recommended to use the Getter/Setter in the constructor too to prevent unexpected behaviour)*

```js
...
if (duedate) {
    this.setDuedate(duedate);
} else if (timeout) {
    this.setTimeout(timeout);
}
...
```

There is only one thing we need to add at this point. It's the scheduler ! And I hope you won't laugh, it's gonna be cute.

Since we infused brain cells into our model and defined the check for Tasks already the only business logic left is to run the check every now and then.

```js
module.exports = async () => {
    setInterval(checkForTasks, 1 * 1000);
}
```

Again as an export, so we can call it directly from the include, we utilise the Javascript method `setInterval` for our check. It expects a callable function and a timeout to wait after each call. Our callable is `checkForTasks` that we defined earlier and we set the timeout..for testing, maybe production in some scenarios..to one second (1000ms). This will run our check function every second, checking our Task Map every second for Tasks that are on due.

That's it basically. We also have to export the Task class to use it in our code. Here is our Scheduler implemented in LexBot for demonstration / later reference.
{{< gist aottr 8c869e4869e54a63f7027eabd1346b0b >}}

# How are we gonna use it in our Discord bot?
Assuming we're inside the main file of our Discord bot, already included the discord.js package and instantiated a Client, we just include our scheduler.js file and assign it to a variable, e.g. `scheduler`. 

```js
const scheduler = require('@util/scheduler');

client.on('ready', async () => {

    scheduler();

    ...
})
```

Inside the event listener for *"ready"* we call the imported scheduler module without any parameters. Our scheduler is now running, checking for Tasks inside the tasks memory every second :3

The following snipped shows how I used the scheduler inside the new MemberCount I wrote for a server.

```js
const { Task, addTask } = require('@util/scheduler');

module.exports = (client) => {
    client.guilds.cache.forEach((guild) => {

        const updateCounter = new Task(`updateCounter-${guild.id}`,
            (context) => {
                guild = context[0]
                updateChannel(guild)
            },
            5*60*1000, undefined, guild)
        addTask(updateCounter)
    })
}
```

At first we include our scheduler, extracting the `Task` model and our `addTask` method utilising Object destructuring. Inside the mod we cycle through every guild (Discord server) our Bot is running on. Then we create a new Task called `updateCounter` with a callback function that runs a function `updateChannel`. This function is known to the mod and expects the guild as context (to count the members / roles on that specific Discord server). As explained earlier additional parameters get mapped to an array, therefore we access the given guild inside the callback via the index 0.

We want to update the channels every now and then, as long as the bot is running. Therefore we have to set a timeout. Timeout was our 3rd parameter according to the Task constructor. 

How many times do we want to check? I think once every 5min is a good value, depending on the size and fluctuation of the server. 5min are equal to *5 * 60 * 1000ms*, since we don't want to have a due date we set it to `undefined`. Last parameter is our context, the parameter we'll pass to our callback function.

The last step is to add the newly generated Task to the scheduler via `addTask` and that's it. Being able to throw functions into a global scheduler using already existing methods from the current context is both shocking and epic !

We don't have to redefine complex sub-functions inside the callback, it just works.

I hope this long article was interesting, helpful or entertaining. As usual feel free to ask in the comments and I'll answer asap and adjust the article :3