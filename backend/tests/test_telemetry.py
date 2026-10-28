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
