## try it on the web here - https://pulsrviz.app/

## a bunch of slop prose from the robot below that i cba rewriting. 

## its just a dumb visualiser but it looks cool huh? i'm autistic as shit and i like when music syncs up with visuals. do whatever you want with this

--------------------
--------------------


pulsr turns the sound playing on your computer into a ridge of lines that moves with the music, drawn in 3D in the browser. Play something in another tab, share that tab with the page, and watch it. Sharing a tab's sound needs Chrome or Edge on a computer. Every browser can play your own music files (pick them, or drop files or a folder on the page; they never leave your computer) or listen through a sound input, which in Firefox on Linux can be the "Monitor of …" input that carries everything the computer plays.

Nothing leaves your computer: the sound is analysed in the page, and there is no server, account or analytics.

## Run it locally

```
npm install
npm run dev
```

Then open http://localhost:8137/

## Desktop app

The same page also runs as a desktop app for macOS, Windows and Linux, built with Electron. There it can listen to everything the computer plays without anything being shared: start it, click "listen to this computer", and play music in any app. On a Mac this needs macOS 14.2 or later, and macOS asks once whether pulsr may hear the computer's sound.

```
npm run desktop        # build the page and open it in the app
npm run desktop:dev    # open the app on the dev server (run `npm run dev` first)
npm run desktop:pack   # build an installer for this system into release/
```

The Mac app is signed ad hoc, so macOS refuses it the first time it is opened: allow it under System Settings, Privacy & Security, "Open Anyway". Windows shows a similar warning, with "More info" and then "Run anyway". On Linux the app comes as a `.deb` for Debian, Ubuntu and their relatives, and its command is `pulsrgui`, since plain `pulsr` is the terminal program.

## Tests

```
npm test
```

## See also

[pulsr](https://github.com/1337raspberry/pulsr), the original terminal program.

## Licence

MIT
