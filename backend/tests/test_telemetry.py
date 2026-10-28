from auditor.telemetry import Telemetry


def test_log_and_read_back(tmp_path):
    t = Telemetry(str(tmp_path / "t.db"))
    t.log("case_started", player_id="P1", case_id="c1", room_code="ABCD", payload={"level": 1})
    t.log("tool_run", player_id="P1", case_id="c1", room_code="ABCD", tool_id="zscore",
          payload={"cost": 2})
    t.log("tool_run", player_id="P2", case_id="c2", tool_id="benford")
    df = t.events_df()
    assert df["type"].tolist() == ["case_started", "tool_run", "tool_run"]
    assert list(df.columns) == ["ts", "type", "player_id", "case_id", "room_code", "tool_id",
                                "payload"]
    assert df.loc[1, "payload"] == {"cost": 2}
    assert df.loc[2, "payload"] == {}
    assert t.events_df(room_code="ABCD")["case_id"].tolist() == ["c1", "c1"]


def test_empty_db(tmp_path):
    assert Telemetry(str(tmp_path / "e.db")).events_df().empty


def test_logging_is_fast_enough_for_a_lecture_hall(tmp_path):
    import time

    t = Telemetry(str(tmp_path / "speed.db"))
    start = time.perf_counter()
    for i in range(200):
        t.log("case_started", player_id=f"P{i}", case_id=f"c{i}", room_code="ROOM")
    assert time.perf_counter() - start < 0.5


def test_accepts_a_database_url(tmp_path):
    t = Telemetry(f"sqlite:///{tmp_path / 'url.db'}")
    t.log("tool_run", player_id="P1", case_id="c1", tool_id="zscore", payload={"cost": 2})
    assert t.events_df()["tool_id"].tolist() == ["zscore"]


def test_postgres_urls_use_the_psycopg_driver():
    from auditor.telemetry import normalise_url

    assert normalise_url("postgres://u:p@h/db?sslmode=require") == \
        "postgresql+psycopg://u:p@h/db?sslmode=require"
    assert normalise_url("postgresql://u:p@h/db").startswith("postgresql+psycopg://")
    assert normalise_url("/tmp/x.db") == "sqlite:////tmp/x.db"


def test_database_url_env_wins(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'env.db'}")
    t = Telemetry()
    t.log("case_started", player_id="P", case_id="c")
    assert (tmp_path / "env.db").exists() and len(t.events_df()) == 1


def test_logging_never_waits_on_a_slow_database(tmp_path, monkeypatch):
    import time as _time

    t = Telemetry(str(tmp_path / "slow.db"))
    real = t._write_batch

    def slow(rows):
        _time.sleep(0.5)  # a far-away database
        real(rows)

    monkeypatch.setattr(t, "_write_batch", slow)
    start = _time.perf_counter()
    for i in range(20):
        t.log("tool_run", player_id=f"P{i}", case_id="c")
    assert _time.perf_counter() - start < 0.2  # players never wait for the database
    assert len(t.events_df()) == 20  # and reading flushes everything first
