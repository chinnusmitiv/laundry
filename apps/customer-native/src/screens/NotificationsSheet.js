import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Sheet, Card, Empty, useTheme, satoshi, fmt } from '@chaselaundry/shared-native';
import { markAllNotificationsRead } from '../lib/api';

export default function NotificationsSheet({ open, onClose, notifs, customer }) {
  const t = useTheme();
  useEffect(() => { if (open) markAllNotificationsRead(customer.id); }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {notifs.length === 0 ? <Empty icon="🔔" title="All clear, nothing for now lah" /> :
        notifs.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10, opacity: n.read ? 0.7 : 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: satoshi(800) }}>{n.title}</Text>
              <Text style={{ fontSize: 11, color: t.gray }}>{fmt.ago(n.created_at)}</Text>
            </View>
            <Text style={{ fontSize: 13, color: t.gray, marginTop: 4 }}>{n.body}</Text>
          </Card>
        ))}
    </Sheet>
  );
}
