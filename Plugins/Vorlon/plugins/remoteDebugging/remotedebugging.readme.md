# Remote Debugging plugin

Remote debugging plugin

## Prerequisites

First of all, you need to install [Chrome Canary](https://www.google.fr/chrome/browser/canary.html) after that the Chrome Canary needs to be started with `--remote-debugging-port=9222` and `--disable-web-security` parameter. For example:

>chrome.exe --remote-debugging-port=9222 --disable-web-security

## Getting Starting

Launch demo.html in the browser.

Press the F9 key on your keyboard.

Open the console.

In Vorlon.JS dashboard click on the client.

Go back in your Chrome Canary where demo.html is open, click on the `test` button you will see a pop-up click `ok`.

Return in Vorlon.JS dashboard in you console you will the `Result expression` with the value who the same result in the pop-up on your client.