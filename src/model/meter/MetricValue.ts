import MetricValueType from "./MetricValueType";

export default interface MetricValue {
    valueType: MetricValueType
    value: string
}