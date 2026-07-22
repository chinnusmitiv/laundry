import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TopBar, Logo, Chip, Card, Avatar, Button, StatusPill, Empty, useTheme, fmt, satoshi } from '@chaselaundry/shared-native';
import { getUser, getShift, getJobs, clockIn, clockOut, ACTIONS } from '../lib/api';
import { getPos } from '../lib/location';
import JobDetailSheet from './JobDetail';

export default function JobsScreen({ driver: driverProp, onLogout }) {
  const t = useTheme();
  const [driver, setDriver] = useState(driverProp);
  const [shift, setShift] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [openJob, setOpenJob] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [d, s, j] = await Promise.all([
      getUser(driverProp.id),
      getShift(driverProp.id),
      getJobs(driverProp.id),
    ]);
    setDriver(d); setShift(s); setJobs(j);
  }, [driverProp.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar
        left={<Logo size={18} mode="dark" />}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Chip variant="navy">DRIVER</Chip>
            <Pressable onPress={onLogout}><Text style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Log out</Text></Pressable>
          </View>
        }
      />
      <FlatList
        data={shift ? jobs : []}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<ShiftCard driver={driver} shift={shift} onChange={load} />}
        ListHeaderComponentStyle={{ paddingHorizontal: 18, paddingTop: 18 }}
        ListEmptyComponent={
          shift
            ? <Empty icon="✅" title="No active jobs" sub="You're all caught up" />
            : <View style={{ paddingHorizontal: 18 }}><Empty icon="⏰" title="You're off the clock" sub="Clock in to receive jobs" /></View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 18 }}>
            <JobRow job={item} onPress={() => setOpenJob(item.id)} />
          </View>
        )}
      />
      <JobDetailSheet jobId={openJob} onClose={() => { setOpenJob(null); load(); }} />
    </View>
  );
}

function ShiftCard({ driver, shift, onChange }) {
  const t = useTheme();
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!shift) return;
    const tick = () => {
      const ms = Date.now() - new Date(shift.clock_in).getTime();
      const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000);
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift]);

  const onClockIn = async () => { const pos = await getPos(); await clockIn(driver.id, pos); onChange(); };
  const onClockOut = async () => { await clockOut(driver.id); onChange(); };

  return (
    <Card style={shift ? { backgroundColor: t.navy2, marginBottom: 14 } : { marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={driver?.name} size={46} color={shift ? t.accent : t.navy} />
          <View>
            <Text style={{ fontFamily: satoshi(900), fontSize: 16, color: shift ? '#fff' : t.text }}>{driver?.name}</Text>
            <Text style={{ fontSize: 12, color: shift ? t.accent : t.gray }}>{shift ? '● On shift' : '○ Off shift'}</Text>
          </View>
        </View>
        {shift && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, fontFamily: satoshi(900), color: '#fff', fontVariant: ['tabular-nums'] }}>{elapsed}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>since {fmt.time(shift.clock_in)}</Text>
          </View>
        )}
      </View>
      <View style={{ marginTop: 16 }}>
        {shift
          ? <Button variant="ghost" style={{ backgroundColor: 'rgba(255,255,255,.12)' }} textStyle={{ color: '#fff' }} onPress={onClockOut}>Clock out</Button>
          : <Button variant="lime" onPress={onClockIn}>Clock in & go online</Button>}
      </View>
    </Card>
  );
}

function JobRow({ job, onPress }) {
  const t = useTheme();
  const a = ACTIONS[job.status];
  return (
    <Card onPress={onPress} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: satoshi(800), color: t.text }}>{job.code} · {job.customer?.name}</Text>
          <Text style={{ color: t.gray, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            📍 {job.address?.line1}, {job.address?.postcode}
          </Text>
        </View>
        <StatusPill status={job.status} label={job.status_label} />
      </View>
      {a && <Text style={{ marginTop: 10, color: t.navy, fontFamily: satoshi(700), fontSize: 13 }}>→ {a.label}</Text>}
    </Card>
  );
}
