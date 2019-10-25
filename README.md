# Matrix Notepad
> A buggy way to collaborate on text documents using the [Matrix](https://matrix.org) protocol. Consider this the Matrix Console of collaboration!

A working demo URL is coming soon.
Come chat at [#matrix-collaboration:kb1rd.net](https://matrix.to/#/!lJKzxfcqmWpRzHxAsh:kb1rd.net?via=matrix.org)! I'd love to hear about what you think (and what issues you encounter)!

## Brief Roadmap
This is not in any particular order:
* [x] More or less working insertations
* [x] More or less working removals
* [ ] Conflict resolution
* [ ] Improved UI/UX (this will be incremental)
* [ ] Unit testing!!!
* [ ] Create a different package for the `Logootish` algorithm
* [ ] Node 'squashing' or similar. Currently Matrix Notepad has to sync ALL of the events :(
* [ ] Text styling (making it a more fully-featured text editor)
In addition, I think it would be a good idea to discuss future possibilities for sharing more than just text over Matrix and the possibility of creating a unified 'app host' client that manages permissions for applications and allows the user to browse a directory structure.

## Usage
As soon as this is up, I'll work on getting a production site live. If you do choose to build it locally in the mean time, the setup is as follows:
Currently, there's no proper sign in, so you sign in with your access token, which can be found under settings in Riot.im.
Click the gear icon in Matrix Notepad. This will open up a sidebar for your settings. You'll need...
* Your homeserver URL (In Riot.im, go to Settings -> About and scroll down)
* An access token (In Riot.im, go to Settings -> About and scroll down)
* A room, which you can create in Riot and then paste the ID into the field. Room aliases are supported

Then, all you need to do is click "Sign In" and start typing! It is normal for signing in to take some time on busy homeservers because it has to run a sync request for all the messages in the room. Sorry for the horrible sign in UX!

## How it Works
This program is based on the well-documented Logoot algorithm. This works by creating a unique ID for each "atom," or character, of text. Each client will then be able to sort the IDs from earliest to latest. Now, if these IDs are allocated sequentially and are all integers, we wouldn't be able to put anything in between them since there's no space between integers. The solution is to add another integer to basically create a new mini-document between the two nodes. This is really confusing at first, so here's an example: Let's say that first I insert `a` at [0] and `c` at [1], but I want to insert `b` between them. I would then give `b` the position [0, 0]. This is just a short and poorly written overview and I'd encourage you to read the [Logoot paper](https://hal.archives-ouvertes.fr/inria-00432368/document) if you're interested!
### So, what is 'Logootish'?
If you read the name of the algorithm in the `algorithms` directory, you'll see that my algorithm is titled `logootish`. In order to make Logoot perform the best for my particular application, I did modify a few things, hence the different name.
* First, Logoot calls for a peer ('site') ID that is used to determine which node comes first in case two peers insert text at the same position. I did not include this. Consider what happens if the network between two homeservers stops working. Alice inserts `test` and Bob inserts `hello`. Each position would be allocated sequentially, with site ID being used to determine position in case of a conflict. Because of this, assuming I'm understanding how the algorithm works correctly, the resulting text would be `theesltlo`. This, for me, is not desired behavior in a conflict since I want the algorithm to handle larger partitions. I would rather that the algorithm prompted the user and had the user decide how they would like the document, rather than introducing confusing changes. **At the moment, I have not written the conflict resolution code. Other than getting bugs out of the existing code, this is at the top of my priority list!**
* Second, Logoot treats each atom as a seperate entity. If I made each atom a seperate Matrix event, the algorithm would be *incredibly* inefficient. So, each event contains both a starting position and a **string** body. The ending position is determined by taking the lowest integer in the position array, (ex, [1, 0, **0**]) and adding the body length to it (ex, [1, 0, **5**], assuming the `body` has a length of 5). This saves many events and memory when typing consecutive text! Most Logoot implementations have something like this.
## Why did I choose what I chose?
* I chose Logoot because it is simple to implement and works well in situations with out-of-order events
* I chose a web app not because I like JavaScript (I don't), but because it's most accessable
* I chose to use Vue.JS because I feel that it makes building intuitive UIs faster. The UI is trash right now, but that will change
* I chose to write my own Logoot algorithm because while there are others, I wanted one that could handle these groups of atoms (which are called `nodes` in my code). The Logoot algorithm that I wrote is much longer than others because it has to deal with merging these lists of nodes together

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
$ npm i

# serve with hot reload at localhost:3000 (for development)
$ npm run dev

# generate static site
$ npm run generate
```
