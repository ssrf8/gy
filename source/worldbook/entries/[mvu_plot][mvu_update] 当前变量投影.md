<status_current_variable>{{get_message_variable::stat_data}}</status_current_variable>

以上为当前状态投影：
- 环境：日期/时间/地点/氛围。
- 角色：角色池。每人：名字、在场（是否在当前场景内）、状态（姿态/处境）、心声（内心所想）。

新登场角色按更新规则 add 完整对象；进出场景替换在场；其余字段随剧情 replace。
读取和更新均以这份状态为准，不用剧情描述代替变量事实。
