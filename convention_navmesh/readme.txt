1. extract zip where u like
########################################

2. Open Command-Prompt/Powershell/Mac Terminal
cd into \Downloads\convention_navmesh_extended\backend (or wherever u extracted the zip)

########################################

3. Install dependencies
pip install -r requirements.txt
(to use pip check if u have python installed by running 'py --version')

OR (similarly)

cd convention_navmesh_extended\backend
pip install Flask flask-cors
or if that doesnt work but you know u have pip:
pip install Flask flask-cors --break-system-packages

########################################

4. stay in the backend folder, then;
py app.py
or
python app.py / python3 app.py
it will host the server on `http://localhost:5000`

########################################

5. open http://localhost:5000 in browser
✨ tada