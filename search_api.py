import urllib.request
import json
url = "https://us-central1-aiplatform.googleapis.com/$discovery/rest?version=v1"
req = urllib.request.urlopen(url)
res = json.loads(req.read())
print("Ok")
