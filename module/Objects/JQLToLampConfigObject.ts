enum AlertType {
	newTicket,
	timeToFirstResponseLessThan,
	timeToResolveLessThan
}

interface JQLToLampConfigObject {
	rgb : string;
	jql : string;
	alert : boolean;
	alertType : AlertType

}

export = JQLToLampConfigObject;