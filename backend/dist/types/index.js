export var TraceStatus;
(function (TraceStatus) {
    TraceStatus["QUEUED"] = "QUEUED";
    TraceStatus["TRACING"] = "TRACING";
    TraceStatus["LABELING"] = "LABELING";
    TraceStatus["SCORING"] = "SCORING";
    TraceStatus["COMPLETED"] = "COMPLETED";
    TraceStatus["FAILED"] = "FAILED";
})(TraceStatus || (TraceStatus = {}));
export var LabelType;
(function (LabelType) {
    LabelType["EXCHANGE"] = "EXCHANGE";
    LabelType["MIXER"] = "MIXER";
    LabelType["SANCTIONED"] = "SANCTIONED";
    LabelType["UNLABELED"] = "UNLABELED";
})(LabelType || (LabelType = {}));
