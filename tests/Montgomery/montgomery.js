'use strict';
var dispatcher = new Dispatcher();
var actions = new Actions(dispatcher);
var store = new Store(dispatcher);
var ec = new EntryCollection(store);
var userInput = new ViewController.UserInput(store);
var sumTable = new ViewController.SumTable(ec);
var projectChart = new ViewController.ProjectChart(ec);
store.load();
//# sourceMappingURL=montgomery.js.map