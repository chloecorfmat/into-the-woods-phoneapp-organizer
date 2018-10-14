function apiCall(method, url, jsonData, callback) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
         if (this.readyState == 4) {
			 callback(this.responseText, this.status);
         }
    };
    xhttp.open(method, url, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.setRequestHeader("Access-Control-Allow-Origin", "https://raidy.sixteam.tech/");
	if (localStorage.getItem('token')!=null) {
    	xhttp.setRequestHeader("X-Auth-Token", localStorage.getItem('token'));
	}
    xhttp.send(JSON.stringify(jsonData));

}

function check_authentification() {
	var status = localStorage.getItem('isAuthenticated');
	console.log (status);
	if (status!="true") {
		window.location.replace("connection.html");
		return false;
	} else {
		return true;
	}
}