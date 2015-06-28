interface IStashBranchResponse {
	size:number;
	start:number;
	limit:number;
	isLastPage:boolean;
	values:[{
		id:string;
		displayId:string;
		latestChangeset:string;
		isDefault:boolean;
		metadata?:{
			"com.atlassian.stash.stash-branch-utils:ahead-behind-metadata-provider" : {
				ahead:number;
				behind:number;
			};
			"com.atlassian.stash.stash-branch-utils:latest-changeset-metadata" : {
				id:string;
				displayId:string;
				author: {
					name:string;
					emailAddress:string;
					avatarUrl:string;
				};
				authorTimestamp:number;
				message:string;
				parents:[{
					id:string;
					displayId:string;
				}]
			}
		};
	}]
}

export = IStashBranchResponse;