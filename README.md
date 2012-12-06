Feels Like PHP
==============

FLP is a project for creating simple websites entirely from underscore templates.
Templates can link to eachother by name, just make sure you prefix all your links with a #

```html
<a href="#page2.html">Go to page 2</a>
```

Each underscore template gets a context with the query parameters from the previous template.

```html
<form method="get" action="#hello.html">
    What is your name?
    <input type="text" name="name">
    <input type="submit" value="Submit">
</form>
```

hello.html:

```html
<p>
    Hello <%- qp.name %>!
</p>
```

Templates have access to few other goodies in addition to query parameters.  (See the API below).

If you want to do something a little complicated, the nice thing about underscore templates is you can
embed blocks of code that run when they're rendered (like PHP pages).

```html
<%
if(!window.visited) {
    window.visited = 0;
}
window.visited++;
%>
<p>This template has been visited <% print(window.visited) %> time(s).</p>
```

Unlike PHP, FLP is all client-side, so you can serve it as static content off github pages,
or make it into offline mobile apps with [phonegap build](https://build.phonegap.com/docs/start).

If you want to do something really complicated you probably shouldn't be using this project.
MV* frameworks have lots of features for structuring complex apps that this project neglects.
Also, debugging underscore templates is aweful.

API
---

qp - an object containing all the query parameters as parsed by backbone-query-parameters.
last - the name of the last page visited.
Log - A log of all the pages visited and query paramemters sent. 

$ and _ are also available.

Example
-------

The top level html files make up an example text adventure game.
The setting might seem familiar if you've read Borges.

Initial page
------------

By default the initial page will be `entrance.html`.
You can changing this by setting the `data-start` attribute in index.html

Tools
-----

None yet, but I have a few ideas.

* A tool that builds a graph from all the links in a the site, perhaps with editing abilities.
* Tools for exploring the log data.

Libraries used to make this
---------------------------

* Backbone
* Underscore
* jQuery
* Require.js
* Backbone-query-parameters
