String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    var time = hours + ':' + minutes//+':'+seconds;
    return time;
}

function createWorklogWidget(data, id) {
    var tmpDiv = $('<div>');

    if (data.approvals) {
        data.approvals.forEach(function (worklog) {


            var progressBar = generateProgressBarForWorklog(worklog.user.displayName, worklog.requiredSeconds, worklog.workedSeconds);
            tmpDiv.append(progressBar);

        })
        $('#' + id).html(tmpDiv.html());
    }


}

function generateProgressBarForWorklog(username, requiredSeconds, workedSeconds) {

    var progressGroup = $('<div>').addClass('progress-group');
    requiredSeconds += "";
    workedSeconds += "";

    //progress text
    $('<div>').addClass('progress-text').html(username).appendTo(progressGroup);
    $('<div>').addClass('progress-number').html(workedSeconds.toHHMMSS() + " / " + requiredSeconds.toHHMMSS()).appendTo(progressGroup);

    var percent = 0;
    var color = 'blue';
    //progress bar
    if (requiredSeconds == 0) {
        percent = 100;
    } else {
        percent = (workedSeconds / requiredSeconds) * 100;
        percent = Math.round(percent);

    }

    if (percent >= 80) {
        color = 'green';
    }

    var progress = $('<div>').addClass('progress');
    $('<div>').addClass('progress-bar progress-bar-striped progress-bar-' + color).css('width', percent + "%").appendTo(progress);
    $('<div>').addClass('progress-marker').appendTo(progress);
    progress.appendTo(progressGroup);


    return progressGroup;

}

$(document).ready(function () {

	$('.btn.delete-confirm').click(function () {
		var _this = this;
		bootbox.confirm('Do you really want to delete this item?', function (result) {
			if (result) {
				window.location = $(_this).data('url');
			}
		})
	})

    //do nothing in the settings menu
    if(typeof dashboardKey == "undefined") {
        return;
    }

    socket = io(window.location.origin + "/" + dashboardKey);

	socket.on('refresh', function () {
		location.reload();
	})

    $('.widget-value').each(function () {
        var id = $(this).attr('id');
        socket.on(id, function (data) {
            switch (data.type) {
                case "accept_calls":
                case "missed_calls":
                case "spreadsheet_value":
                case "tickets_count":
                    $('#' + id).html(data.value);
                    break;
              case "reachability_percent":
                    $('#' + id).html(data.value + "%");

                    break;
                case "worklog":
                    createWorklogWidget(data.value, id);
                    break;
                default :
                    console.log("Unknown Type: " + data.type);
                    break
            }

        })

    });


});


