+++
title = 'Improving the simple scheduler'
date = 2021-09-12T19:31:34+02:00
draft = false
tags = ['discord', 'backend']
images = ['https://storage.ko-fi.com/cdn/useruploads/display/7f6f85de-10e4-419e-933c-d9ea473451e7_screenshot2021-08-16at12.24.33.png']
+++

This is the second part covering the simple scheduler script. In case you didn't read the first part [Writing a simple scheduler for a Discord bot](/posts/2021/08-17-simple-scheduler-discord-bot/) it is encouraged to read it first for the context. Thank you :3


Our first attempt to schedule tasks inside our Discord bot contained a lot of clutter and unused variables / parameters. After giving the scheduler a second thought and re-reading my own article about it, I wanted to improve the code a bit and make it more tidy and clean.

At first, we gonna take a look at the `Task` class, our data model. The old model contained a lot of business logic since the rest of the scheduler was purely functional coded.

The only consistent parameters for a task are the name (for identification) and the callback-function we want to run. Therefore, we can strip the constructor to only two parameters.

```js
class Task {
    constructor(name, callback) {
        this._name = name;
        this._callback = callback;
    }
}
```

The underscore in front of the variable name is meant as an indicator for the future developers, that we're dealing with **"private" variables** here. There are no access restrictions in regular **JS ES6** classes unlike in **TypeScript**.

Since we can have either a dedicated *due-date* or an *interval*, we want to run our callback at (formerly called timeout), we won't set them in the constructor anymore but in dedicated methods instead. Inspired from the `MessageEmbed` class of *discord.js*, we write the setter-Methods to return the current instance of the task model, allowing us to concat the method calls when instantiating the model.

```js
setInterval(interval) {
    this._interval = interval;
    this._duetime = Date.now() + interval;
    return this;
}

setDuedate(duedate) {
    this._duetime = duedate;
    return this;
}

setContext(context) {
    this._context = context;
    return this;
}
```

We want to call `setInterval` if we want to run the task within a certain interval. It will assign the desired interval value to a class variable and set the internal due-time of the task to the current timestamp + the interval. `_duetime` represents the timestamp we want our task to run at. If we want to run the Task only once at a certain time, we use the method `setDuedate` to set the `_duetime` to that exact timestamp. The last method `setContext` replaces the ...params parameter that existed in the old version of the task model. Since we can easily assign any object or array as parameter, it's not necessary to force an array structure. Now we can assign destructured objects or arrays or simple variables and let the callback function decide how to handle it. Since we're returning this in every set-method, we can easily concat them while instantiating the Task class.

Let's take a look at a simple example to write `Hello World` every 5 seconds.
```js
new Task('hello', () => { console.log('Hello World') })
    .setInterval(5000);
```

This little snippet will return a new Task instance while setting the interval to 5000ms. We can also append the `setContext` to the call to set parameters for the callback, analog to `setInterval`.

To access the values of the interval and the due-time, we'll use the built-in `get`/`set` keywords for ES6 classes.
```js
get duetime() {
    return this._duetime;
}

get interval() {
    return this._interval;
}
```
This allows us to have public read-only access to the internal variables that looks similar to the access of regular object properties.

**If you want me to write a separate article about ES6 classes in JavaScript and TypeScript, leave a comment below :3**

The only missing part of the new Task class is the `run`-method. The old scheduler used to contain a lot of logic in the `run`-method, deciding whether to call the action or not. We're moving that logic to a dedicated Scheduler class now leaving the `Task.run` with only two lines of code.
```js
run() {
    this._callback(this._context);
    if (this._interval) this.setInterval(this._interval);
}
```

The first line runs the defined callback function with the set context (or undefined). In regular JavaScript it doesn't matter if the context variable is undefined or not. The second line checks if an interval is defined and resets it. 

If we don't have an interval but a due-date, we don't want to reset the time since it's a single call only operation. In this case the internal `_duetime` will remain with an old timestamp and be deleted by our "Garbage Collector" in the upcoming Scheduler class.

```js
class Task {

    constructor(name, callback) {
        this._name = name;
        this._callback = callback;
    }

    setInterval(interval) {
        this._interval = interval;
        this._duetime = Date.now() + interval;
        return this;
    }
    setDuedate(duedate) {
        this._duetime = duedate;
        return this;
    }
    setContext(context) {
        this._context = context;
        return this;
    }

    get duetime() {
        return this._duetime;
    }
    get interval() {
        return this._interval;
    }

    run() {
        this._callback(this._context);
        if (this._interval) 
            this.setInterval(this._interval);
    }
}
```

After taking a look at the full Task class it's time to tackle the new Scheduler class, replacing the former functional approach

```js
class Scheduler {
    constructor (interval) {
        this.interval = interval;
        this.tasks = new Map();

        setInterval(
            () => {
                for (const [name, task] of this.tasks) {
                    if (Date.now() > task.duetime) task.run();
                    if (Date.now() > task.duetime) this.tasks.delete(name);
                }
            }, this.interval
        )
    };

    add(task) {
        this.tasks.set(task.name, task);
    };
}
```

The constructor lets us set a check interval (in ms) now, defining in what cycle the scheduler should check for tasks on due. The constructor also contains the built-in `setInterval` function that iterates through every task in the `tasks` map.

The old loop just let the Task model decide whether it's time to call the callback function or not. We moved that decision to the Scheduler class now by checking if the current timestamp is higher than the timestamp we want the task to run at (`task.duetime`). We're also checking the due-time in the next if-clause to decide whether we have to delete the task or not. Remember how we set the due-time in the setInterval- and run-method of the new Task class? If it's a recurring task with an interval, the due-time will be reset to a new value in the future. If not, the due-time will remain in the past and removed from the map.

The Scheduler class also has a method add to add a new task to the list, this replaces the `addTask` method of the old approach.

The last step is to create and export a simple singleton of the new Scheduler class, so we always get the same instance when accessing the Scheduler from other modules.

```js
let instance;
module.exports.Scheduler = (interval = 5000) => {
    if (!instance) {
        instance = new Scheduler(interval);
    }
    return instance;
}
```

With `let instance;` we're defining a variable whos value can change in the future. Then we export a function with an `interval` parameter (default value 5000ms) that returns the value of the `instance` variable. If the `instance` variable still has `undefined` as value, the `Scheduler` hasn't been instantiated yet so we check this first and create a new instance with the given `interval` if necessary. 

Done :3 

A simple singleton instance that lets us the same `Scheduler` instance everywhere via a simple `Scheduler()` call.