import sqlite3
import shutil
import os

def create_database():

  # Define the schema SQL
  SCHEMA_SQL = """
  -- Drop old tables if they exist
  DROP TABLE IF EXISTS objs;
  DROP TABLE IF EXISTS objs_fts;

  -- Main table for objects
  CREATE TABLE objs (
      objid       INTEGER PRIMARY KEY,
      map_type    TEXT,
      map_name    TEXT,
      actor       TEXT,
      name        TEXT,
      translate   TEXT,
      scale       TEXT,
      params      TEXT,
      conditions  TEXT,
      hash_id     INTEGER,
      hash        TEXT,
      data        TEXT,
      group07_id  INTEGER,
      group10_id  INTEGER,
      region12    TEXT,
      gen_group   INTEGER
  );

  -- Full text search virtual table
  CREATE VIRTUAL TABLE objs_fts
  USING fts5(
      name,
      actor,
      map_name,
      content='objs',
      content_rowid='objid'
  );

  -- Triggers to keep FTS table updated
  CREATE TRIGGER objs_ai AFTER INSERT ON objs BEGIN
    INSERT INTO objs_fts(rowid, name, actor, map_name)
    VALUES (new.objid, new.name, new.actor, new.map_name);
  END;

  CREATE TRIGGER objs_ad AFTER DELETE ON objs BEGIN
    INSERT INTO objs_fts(objs_fts, rowid, name, actor, map_name)
    VALUES('delete', old.objid, old.name, old.actor, old.map_name);
  END;

  CREATE TRIGGER objs_au AFTER UPDATE ON objs BEGIN
    INSERT INTO objs_fts(objs_fts, rowid, name, actor, map_name)
    VALUES('delete', old.objid, old.name, old.actor, old.map_name);
    INSERT INTO objs_fts(rowid, name, actor, map_name)
    VALUES (new.objid, new.name, new.actor, new.map_name);
  END;

  CREATE TABLE region12 (
      objid INTEGER PRIMARY KEY,
      id INTEGER,
      map_name text NOT NULL,
      name text NOT NULL,
      data JSON NOT NULL
  );

  CREATE TABLE region16 (
      objid INTEGER PRIMARY KEY,
      id INTEGER,
      map_name text NOT NULL,
      name text NOT NULL,
      data JSON NOT NULL
  );

  CREATE TABLE region18 (
      objid INTEGER PRIMARY KEY,
      id INTEGER,
      map_name text NOT NULL,
      name text NOT NULL,
      data JSON NOT NULL
  );
  """

  # Create an in-memory database
  conn = sqlite3.connect(":memory:")
  cursor = conn.cursor()

  # Run the schema SQL
  cursor.executescript(SCHEMA_SQL)
  conn.commit()

  # Path to save the database
  db_file = "map.db"

  # If the file exists, remove it
  if os.path.exists(db_file):
      os.remove(db_file)

  # Use SQLite backup API to write the in-memory DB to a file
  disk_conn = sqlite3.connect(db_file)
  with disk_conn:
      conn.backup(disk_conn)

  disk_conn.close()
  conn.close()

  print(f"Database written to {db_file}")
