lnwebcli.directive("getInfo", [function () {
	return {
		restrict: "E",
		replace: true,
		transclude: false,
		templateUrl: "templates/partials/lnd/getinfo.html",
	};
}]);
