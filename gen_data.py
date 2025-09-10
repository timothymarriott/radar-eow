import sqlite3
import json
from typing import List, Optional, Dict, Any
from pathlib import Path
from os import listdir
from os.path import isfile, join
import tqdm
import os
import create_database
import time

def load_db(path: str) -> sqlite3.Connection:
    """
    Load an SQLite database from a file path.
    Returns a sqlite3.Connection object.
    """
    conn = sqlite3.connect(path)
    return conn
def add_item(
    conn: sqlite3.Connection,
    map_name: str,
    actor: Optional[str] = None,
    name: Optional[str] = None,
    translate: Optional[Dict[str, Any]] = None,
    scale: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    conditions: Optional[Dict[str, Any]] = None,
    hash_id: Optional[int] = None,
    hash_val: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    group07_id: Optional[int] = None,
    group10_id: Optional[int] = None,
    region12: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Insert a new item into the objs table.
    Returns the objid of the inserted row.
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO objs (
            map_name, actor, name, translate, scale,
            params, conditions, hash_id, hash, data,
            group07_id, group10_id, region12
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            map_name,
            actor,
            name,
            json.dumps(translate) if translate else None,
            json.dumps(scale) if scale else None,
            json.dumps(params) if params else None,
            json.dumps(conditions) if conditions else None,
            hash_id,
            hash_val,
            json.dumps(data) if data else None,
            group07_id,
            group10_id,
            json.dumps(region12) if region12 else None,
        ),
    )
    conn.commit()
    return cursor.lastrowid
def remove_item(conn: sqlite3.Connection, objid: int) -> None:
    """
    Remove an item from the objs table by objid.
    """
    cursor = conn.cursor()
    cursor.execute("DELETE FROM objs WHERE objid = ?", (objid,))
    conn.commit()
def clear_table(conn: sqlite3.Connection) -> None:
    """
    Remove all items from the objs table.
    """
    cursor = conn.cursor()
    cursor.execute("DELETE FROM objs")
    conn.commit()
def save_db(conn: sqlite3.Connection, path: str) -> None:
    """
    Save the modified database to a new file.
    """
    # Use SQLite's backup API
    dest = sqlite3.connect(path)
    with dest:
        conn.backup(dest)
    dest.close()

def add_region(
    conn: sqlite3.Connection,
    table: str,
    map_name: str,
    region_id: int,
    name: str,
    points: List[Dict[str, float]],
) -> int:
    """
    Insert a region into a region table (e.g., region12).
    Data is stored as a JSON array of [x, y] pairs.
    """
    cursor = conn.cursor()
    coords = [[p["X"], p["Y"]] for p in points]
    cursor.execute(
        f"""
        INSERT INTO {table} (id, map_name, name, data)
        VALUES (?, ?, ?, ?)
        """,
        (region_id, map_name, name, json.dumps(coords)),
    )
    conn.commit()
    return cursor.lastrowid


def gen_level(db: sqlite3.Connection, name: str):
    data = json.load(open(f"content/map/{name}.json", "r"))

    # Insert actor objects if present
    if "actors" in data:
        actors = data["actors"]
        print(f"Generating objs for {name} from {len(actors)} actors")
        for actor in tqdm.tqdm(actors):
            add_item(
                db,
                name,
                actor[18],
                actor[18],
                {"x": actor[0][0], "y": actor[0][1], "z": actor[0][2]},
                {
                    "min_x": actor[6],
                    "min_y": actor[7],
                    "min_z": actor[8],
                    "max_x": actor[9],
                    "max_y": actor[10],
                    "max_z": actor[11],
                },
                actor[13],
                actor[12],
                actor[14],
                hex(actor[14]),
                {},
                0,
                0,
                {},
            )

    # Insert regions into region12


def create_region(name: str):
    levelData = json.load(open(f"E:\\Development\\Modding\\NFormats\\data\\export\\sections\\{name}.json", "r"))
    for lvl in tqdm.tqdm(levelData["levels"]):
        map_name = lvl["level"]  # <-- use level key as map_name
        regions = lvl.get("regions", [])
        for i, region in enumerate(regions):
            coords = [[pt["X"], pt["Y"]] for pt in region.get("Points", [])]
            add_region(
                db,
                name,          # fixed table
                map_name,            # map_name = level name
                i,                   # id field
                region["name"],      # name column
                region["Points"],    # original points
                )

# Example usage:
if __name__ == "__main__":
    print("Connecting...")

    if os.path.exists("map.db"):
        create_database.create_database()
        time.sleep(0.5)

    db = load_db("map.db")
    print("Connected")



    SEARCHDIR = "content/map"

    onlyfiles = [f for f in listdir(SEARCHDIR) if isfile(join(SEARCHDIR, f))]


    clear_table(db)

    for f in onlyfiles:
        name = f.replace(".json", "")

        gen_level(db, name)

    create_region("region12")
    create_region("region16")
    create_region("region18")

    print("Complete")
    db.close()
