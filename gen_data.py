import os, json, sqlite3

db = sqlite3.connect("map.db")
cur = db.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS objs (HashID INTEGER PRIMARY KEY, X REAL, X REAL, X REAL, Name TEXT, ActorParams TEXT)")

for file in os.listdir("json_folder"):
    if not file.endswith(".json"):
        continue
    with open(os.path.join("json_folder", file), "r") as f:
        data = json.load(f)
        # adjust this depending on structure
        cur.execute("INSERT INTO data (key1, key2) VALUES (?, ?)",
                    (data["field1"], data["field2"]))

db.commit()
db.close()
