interface InoplaCall {

	callId:string;
	dateTime:string;
	caller:string;
	service:string;
	ddi:number
	durationIn:number;
	durationOut:number;
	successfully:boolean

}

export = InoplaCall;