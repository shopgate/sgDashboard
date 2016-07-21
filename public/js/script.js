angular.module('sgDashboard', ['ui.bootstrap', 'ngAnimate'])
	.factory('socket', ['$rootScope', function ($rootScope) {
		var socket = io.connect(window.location.origin + "/" + dashboardKey);
		console.log("socket created");
		socket.on('refresh', function () {
			location.reload();
		})

		return {
			on: function (eventName, callback) {
				function wrapper() {
					var args = arguments;
					$rootScope.$apply(function () {
						callback.apply(socket, args);
					});
				}

				socket.on(eventName, wrapper);

				return function () {
					socket.removeListener(eventName, wrapper);
				};
			},

			emit: function (eventName, data, callback) {
				socket.emit(eventName, data, function () {
					var args = arguments;
					$rootScope.$apply(function () {
						if (callback) {
							callback.apply(socket, args);
						}
					});
				});
			}
		};
	}])
	.filter('toHHMMSS', function () {
		return function (item) {
			var sec_num = parseInt(item, 10); // don't forget the second param
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
		};
	})
	.controller('WidgetController', function (socket) {

		this.noPause = true;

		this.color = {};
		this.icon = {};

		var scope = this;
		widgetConfigs.forEach(function (element) {
			console.log(element);

			scope[element.key] = '-';
			socket.on(element.key, function (data) {

				scope[element.key] = data.value;
				var bgColor = 'bg-' + element.appearance.color;
				var icon = element.appearance.icon;

				if(element.appearance.limitsActive) {

					var checkValue = data.value.replace(/%/g, '');

					//check lower limit
					if(checkValue < element.appearance.lowLimit.value) {
						bgColor = 'bg-' + element.appearance.lowLimit.color;
						icon = element.appearance.lowLimit.icon;

					}
					if(checkValue > element.appearance.highLimit.value) {
						bgColor = 'bg-' + element.appearance.highLimit.color;
						icon = element.appearance.highLimit.icon;
					}
				}

				scope.color[element.key] = bgColor;
				scope.icon[element.key] = icon

			});

		})

	});
