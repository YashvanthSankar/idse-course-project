import pytest
from pydantic import ValidationError

from auditor.models import Accusation, CaseMeta

TRUTH_FIELDS = {
    "fraudster_id",
    "scheme",
    "fraud_txn_ids",
    "catching_tools",
    "herrings",
    "explanation",
}


@pytest.mark.parametrize("ids", [["a"], ["a", "b", "c"]])
def test_accusation_requires_exactly_two_evidence(ids):
    with pytest.raises(ValidationError):
        Accusation(suspect_id="E1", evidence_ids=ids)


def test_accusation_accepts_two_evidence():
    acc = Accusation(suspect_id="E1", evidence_ids=["a", "b"])
    assert acc.evidence_ids == ["a", "b"]


def test_case_meta_has_no_truth_fields():
    assert set(CaseMeta.model_fields).isdisjoint(TRUTH_FIELDS)
