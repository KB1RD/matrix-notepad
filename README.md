![Matrix Notepad](static/logo/notepad%20logo.svg)
> A buggy way to collaborate on text documents using the [Matrix](https://matrix.org) protocol. When it works, consider this the Matrix Console of collaboration!

Check it out at [matrix-notepad.kb1rd.net](https://matrix-notepad.kb1rd.net/) and come chat at [#matrix-collaboration:kb1rd.net](https://matrix.to/#/!lJKzxfcqmWpRzHxAsh:kb1rd.net?via=matrix.org)! I'd love to hear about what you think (and what issues you encounter)!

## Brief Roadmap
This is not in any particular order:
* [x] More or less working insertations
* [x] More or less working removals
* [ ] Conflict resolution
* [ ] Improved UI/UX (this will be incremental)
* [ ] Unit testing!!!
* [ ] Create a different package for the `Logootish` algorithm
* [ ] Node 'squashing' or similar. Currently Matrix Notepad has to sync ALL of the events :(
* [ ] Rich text editing

In addition, I think it would be a good idea to discuss future possibilities for sharing more than just text over Matrix and the possibility of creating a unified 'app host' client that manages permissions for applications and allows the user to browse a directory structure.

## Why write this?
Fundementally, it is frustrating that there is no standard way to collaborate on the Internet. There are a bunch of systems to collaborate online, but they require that you trust a single company and, most of the time, have an account with that company. Just as Matrix was founded with the goal of making communication standardized just the way email is, this project was started with the goal of providing a proof-of-concept of how standardized collaboration could work over the Internet and over Matrix.

## Usage
Just head on over to [matrix-notepad.kb1rd.net](https://matrix-notepad.kb1rd.net/) and sign in. This will bring you to a room list. It's not a great idea to re-use rooms, so if you haven't joined a document room yet, click the "Add" button at the top of the room list and either create a room or join an existing one by ID or alias.

### WARNING!
First of all, since this is experimental software, do not use it to store very important or confidential information. Second, I have recommended to some of the Matrix devs that they create another account to test this program. This program *shouldn't* do anything to break anyone's account -- I use it on my normal Matrix account and nothing bad has happened. Yet. I suggested that they use another account because their job depends upon a working account. If you *absolutely* need your Matrix account every day, I would recommend creating another account just to be safe. This program will:
1.) Post a good number of events to whichever room you choose. If you use this to type out a novel or something, it may slow down Riot since sync requests get larger, but this shouldn't be too much of an issue
2.) Scroll back as far as possible in whichever room you choose. For this reason, **do not** open public chats since the editor will try to sync back to the beginning of time and probably crash your browser. I'm working on a more efficient sync system. See issue #11

### Bug Reporting
If you see error messages pop up or you encounter any bugs, **please** report it either on GitHub or on the Matrix chat. This is **very** helpful as I'm sure there are bugs that I don't know about.

## Screenshots
![Sign in](static/signin.png)
![Room List](static/roomlist.png)
![Document Editing](static/document.png)

## Contributing
Have a look at the [Wiki](https://github.com/KB1RD/matrix-notepad/wiki) if you're interested in contributing. The wiki also contains documentation about how this works.

## Organization
Here is the directory structure
* `algorithms` -- A directory for possible algorithms in case I ever want to develop others. This is more of an organizational thing
  * `/logootish` -- The `logootish` algorithm that I developed. This is the more interesting of all the directories
    * `/index.js` -- The main Logootish algorithm
    * `/bst.js` -- A custom binary sorting tree that supports custom compare functions and supports getting groups of nodes. This is used to select regions of nodes to consider. This may need a rewrite
    * `/ints.js` -- A custom `Int32` type. I implemented this so that any int-based type would have a standard interface using methods rather than operators because JavaScript doesn't support operator overloading. In the future, it would be possible to replace the `Int32` type with any other int type because of this interface. Because it's only an Int32, the document will have issues if you add 2^31 characters consecutively, but then again so will most web browsers :)
    * `utils.js` -- Random utilities that I should move somewhere else. This includes `Enum`, `arraymap`, `PeekableIterator`, and `FatalError`
* `components` -- Vue components
* `layouts` -- Nuxt layouts. This is currently just the default layout
* `pages` -- Nuxt pages
* `plugins` -- Nuxt plugins that perform vital functions for the program that are not the algorithm or the Vuex store
* `static` -- Static files. Currently only has the site icon
* `store` -- The Vuex store. This is used for UI only since I want the algorithm to be seperate from Vue.JS. Vuex does track the state of the Matrix client, but not the state of document nodes (that's all "traditional" ES6 JS)
* `test` -- A directory that I have reserved for unit testing. This would help **a lot** if I actually implemented it. *sigh*

## Build Setup

``` bash
# install dependencies
$ yarn install

# serve with hot reload at localhost:3000 (for development)
$ yarn run dev

# generate static site
$ yarn run generate

# get webpack bundle statistics
$ yarn run stats
```
