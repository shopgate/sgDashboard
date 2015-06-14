import Location = require('./Location');

var locationToLights = {};

locationToLights[Location.values.BUTZBACH] = [
	{id: "1", name: "1"},
	{id: "2", name: "2"},
	{id: "3", name: "3"},
	{id: "4", name: "4"},
	{id: "5", name: "Second Level"},
	{id: "6", name: "First Level"},
	{id: "7", name: "Team Opertations 2"},
	{id: "8", name: "Second Level 2"},
	{id: "9", name: "First Level 2"},
];
locationToLights[Location.values.MAGDEBURG] = [
	{id: "1", name: "Living Colors"},
	{id: "3", name: "Bulb TV left"},
	{id: "4", name: "Bulb TV right"},
];


export = locationToLights;