enum LocationValues {
	BUTZBACH,
	MAGDEBURG,
	BERLIN,
	GILBERT,
	SANFRANCISCO
}

var locationNames = {};
locationNames[LocationValues.BUTZBACH] = "Butzbach, DE";
locationNames[LocationValues.MAGDEBURG] = "Magedeburg, DE";
locationNames[LocationValues.BERLIN] = "Berlin, DE";
locationNames[LocationValues.GILBERT] = "Gilbert,AZ, US";
locationNames[LocationValues.SANFRANCISCO] = "San Francisco, AZ, US";

export var values = LocationValues;
export var names = locationNames;