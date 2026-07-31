import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function RulesScreen() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [ruleType, setRuleType] = useState<'curfew' | 'late-entry' | 'leave'>('curfew');
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const hostels = await api.getHostels();
      if (hostels.data && hostels.data.length > 0) {
        const hostelId = hostels.data[0]._id;
        const response = await api.getRules(hostelId);
        setRules(response.data || []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCurfew = async () => {
    try {
      const hostels = await api.getHostels();
      if (!hostels.data || hostels.data.length === 0) {
        Alert.alert('Error', 'Please create a hostel first');
        return;
      }

      await api.createCurfewRule({
        hostelId: hostels.data[0]._id,
        weekday: formData.weekday,
        weekend: formData.weekend,
      });
      Alert.alert('Success', 'Curfew rule created');
      setModalVisible(false);
      loadRules();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create rule');
    }
  };

  const handleCreateLateEntry = async () => {
    try {
      const hostels = await api.getHostels();
      if (!hostels.data || hostels.data.length === 0) {
        Alert.alert('Error', 'Please create a hostel first');
        return;
      }

      await api.createLateEntryRule({
        hostelId: hostels.data[0]._id,
        allowedTimes: formData.allowedTimes?.split(',') || [],
        fineAmount: parseFloat(formData.fineAmount),
        maxViolations: parseInt(formData.maxViolations),
        escalationAfter: parseInt(formData.escalationAfter),
      });
      Alert.alert('Success', 'Late entry rule created');
      setModalVisible(false);
      loadRules();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create rule');
    }
  };

  const handleCreateLeave = async () => {
    try {
      const hostels = await api.getHostels();
      if (!hostels.data || hostels.data.length === 0) {
        Alert.alert('Error', 'Please create a hostel first');
        return;
      }

      await api.createLeavePolicy({
        hostelId: hostels.data[0]._id,
        maxLeaveDays: parseInt(formData.maxLeaveDays),
        maxConsecutiveDays: parseInt(formData.maxConsecutiveDays),
        requireParentApproval: formData.requireParentApproval === 'true',
        autoExpiry: formData.autoExpiry === 'true',
        expiryDays: parseInt(formData.expiryDays),
      });
      Alert.alert('Success', 'Leave policy created');
      setModalVisible(false);
      loadRules();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create policy');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRules} />}
      >
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              setRuleType('curfew');
              setFormData({});
              setModalVisible(true);
            }}
          >
            <Ionicons name="time" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Curfew Rule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              setRuleType('late-entry');
              setFormData({});
              setModalVisible(true);
            }}
          >
            <Ionicons name="enter" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Late Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createButton}
            onPress={() => {
              setRuleType('leave');
              setFormData({});
              setModalVisible(true);
            }}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Leave Policy</Text>
          </TouchableOpacity>
        </View>

        {rules.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No rules configured</Text>
          </View>
        ) : (
          rules.map((rule) => (
            <View key={rule._id} style={styles.card}>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
              <Text style={styles.ruleType}>{(rule.ruleType || 'rule').toString().toUpperCase()}</Text>
              {rule.curfewConfig && (
                <View>
                  <Text style={styles.configText}>
                    Weekday: {rule.curfewConfig.weekday}
                  </Text>
                  <Text style={styles.configText}>
                    Weekend: {rule.curfewConfig.weekend}
                  </Text>
                </View>
              )}
              {rule.lateEntryConfig && (
                <View>
                  <Text style={styles.configText}>
                    Fine: ₹{rule.lateEntryConfig.fineAmount}
                  </Text>
                  <Text style={styles.configText}>
                    Max Violations: {rule.lateEntryConfig.maxViolations}
                  </Text>
                </View>
              )}
              {rule.leaveConfig && (
                <View>
                  <Text style={styles.configText}>
                    Max Leave Days: {rule.leaveConfig.maxLeaveDays ?? '—'}
                  </Text>
                  <Text style={styles.configText}>
                    Parent Approval: {rule.leaveConfig.requireParentApproval ? 'Yes' : 'No'}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Create {ruleType === 'curfew' ? 'Curfew' : ruleType === 'late-entry' ? 'Late Entry' : 'Leave'} Rule
            </Text>

            {ruleType === 'curfew' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Weekday Time (HH:mm)"
                  value={formData.weekday}
                  onChangeText={(text) => setFormData({ ...formData, weekday: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Weekend Time (HH:mm)"
                  value={formData.weekend}
                  onChangeText={(text) => setFormData({ ...formData, weekend: text })}
                />
              </>
            )}

            {ruleType === 'late-entry' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Allowed Times (comma separated)"
                  value={formData.allowedTimes}
                  onChangeText={(text) => setFormData({ ...formData, allowedTimes: text })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Fine Amount"
                  value={formData.fineAmount}
                  onChangeText={(text) => setFormData({ ...formData, fineAmount: text })}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Max Violations"
                  value={formData.maxViolations}
                  onChangeText={(text) => setFormData({ ...formData, maxViolations: text })}
                  keyboardType="numeric"
                />
              </>
            )}

            {ruleType === 'leave' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Max Leave Days"
                  value={formData.maxLeaveDays}
                  onChangeText={(text) => setFormData({ ...formData, maxLeaveDays: text })}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Max Consecutive Days"
                  value={formData.maxConsecutiveDays}
                  onChangeText={(text) => setFormData({ ...formData, maxConsecutiveDays: text })}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Require Parent Approval (true/false)"
                  value={formData.requireParentApproval}
                  onChangeText={(text) => setFormData({ ...formData, requireParentApproval: text })}
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={() => {
                  if (ruleType === 'curfew') handleCreateCurfew();
                  else if (ruleType === 'late-entry') handleCreateLateEntry();
                  else handleCreateLeave();
                }}
              >
                <Text style={styles.submitButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    flexWrap: 'wrap',
  },
  createButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ruleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 8,
  },
  ruleType: {
    fontSize: 12,
    color: '#0a7ea4',
    marginBottom: 10,
    fontWeight: '500',
  },
  configText: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#11181C',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

