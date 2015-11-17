# Octobot
## Node.js IRC bot

This is the core functionality of the [OCTOTROG](https://github.com/neckro/OCTOTROG) IRC bot, with a somewhat friendlier API.

The core is event-driven.  Plugin modules are able to pass data to each other asynchronously.  There is also an "easy" API especially for IRC events.

## Installation

Nothing special.  Some dependencies are for specific plugins and can be skipped:

 * SQLite3 (`database` plugin) -- You need the sqlite3 dev headers installed.  On Debian/Ubuntu this is package `libsqlite3-dev`.

## Configuration

In your bootstrap file you can start the bot and load plugins.  See `example.js` for same.

## Command line

Assuming your script runs `start()`, you can use these command line parameters:

* `start`: Starts the Octobot daemon.
* `stop`: Stops the Octobot daemon.
* `restart`: You get the picture.

With no parameters, the bot will run normally in the foreground instead of daemonizing.

# API

This documentation is incomplete/missing.  More soon, I promise.

TODO: Document plugin events, plugin methods, `evt`

### `new Octobot(config)`

Prepare an Octobot instance.  This is actually an event queue that starts the real bot if necessary.  Passing a `config` here is equivalent to `Octobot.config(config)`.

### `Octobot.config(config)`

Sets core bot configuration options.  Currently there are no such options!

### `Octobot.load(pluginName, pluginOptions)`

Loads a plugin with associated options.  Plugin modules should be located in a `plugins` directory relative to the module that loaded the bot.  Relative paths beginning with '.' and absolute paths are also allowed.  If no matching plugin is found in any of these places or in the Octobot core plugins, the plugin module will be loaded as if it was `require`'d from the startup script.

## Plugin API

The following plugins come "included":

* `irc`
* `main`
* `logger`
* `database`
* `dictionary`

A plugin module should export a plain object with these properties.  Any extra properties will be added as mixins to the plugin instance when it's created.

* `name` _(string)_: Plugin name.
* `defaults` _(object)_: Default settings.
* `init` _(function)_: Called after plugin is instantiated and config and event listeners are initialized.
* `destroy` _(function)_: Called on plugin unload, at least in theory, because plugins can't unload yet.
* `listeners` _(object)_: A hash of `{ event: listener(evt) }`.  The `evt` object enables asynchronous communication between plugins by resolving the event's promise using `evt.resolve()`.
* `prefix` _(string)_: The prefix for IRC commands (e.g. "!").  A shortcut that makes it easier to put IRC commands in a particular prefixed namespace.
* `commands` _(object)_: IRC commands as a hash of `{ command: command_options }` where `command_options` has the following properties:
  * `no_space` _(string)_: Allow the command to run without a space between the command and any parameters?
  * `description` _(string)_: Used by the `!help` command and also serves as convenient documentation.
  * `response` _(function)_: Called with parameters `(evt, msg)` where `evt` is the initial event object and `msg` is a `node-irc` message object augmented with:
    * `reply` _(function)_: Reply directly to the triggering message (either via PRIVMSG or to a channel).  Can be used multiple times.
    * `replyto` _(string)_: The nick that sent the message (if PRIVMSG) or channel (if not).
    * `from` _(string)_: Nick the message came from.
    * `to` _(string)_: Where the message was directed (nick or channel).
    * `privmsg` _(boolean)_: Was this a PRIVMSG?
    * `msg` _(string)_: The text of the IRC message, minus the command itself.
    * `text` _(string)_: Full text of the message.
    * `params` _(array[string])_: `msg` split by word, for convenience.
    * `raw` _(object)_: The  `node-irc` raw message object.  See: https://node-irc.readthedocs.org/en/latest/API.html#'raw'
