## Events triggering logging
* `/dump` with a correct password (no flush)
* `/wakeup`, only if `Searches.refreshNeeded()` found `true`, and then logging will also flush the memory
### How to log
1. Query a couple of keywords with the bot
2. GET at `/dump/:secret`
3. GET at `/stats`
